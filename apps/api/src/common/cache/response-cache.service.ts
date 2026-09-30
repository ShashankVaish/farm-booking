import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/*
  Redis cache for public, anonymous GET responses (search, listing pages,
  reviews, amenities, plans).

  Invalidation is by generation rather than by hunting keys: every cached key
  embeds the current generation number, and any write to the API bumps it, so
  all older entries stop being read at once and simply age out on their TTL.
  Writes are rare next to reads, so dropping the whole public cache on each
  one costs almost nothing and can never leave a stale listing behind.

  It fails open. With no REDIS_URL, or Redis down, every call is a no-op and
  requests go to the database as they did before — the cache can make the
  site faster, never break it.
*/

const GENERATION_KEY = 'rc:gen';
/** A cache call slower than this is abandoned; the request just misses. */
const REDIS_TIMEOUT_MS = 150;
/** Several writes in quick succession send one refresh to the website. */
const WEB_REFRESH_DEBOUNCE_MS = 1_500;

function withTimeout<T>(work: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    work.catch(() => fallback),
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), REDIS_TIMEOUT_MS),
    ),
  ]);
}

@Injectable()
export class ResponseCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(ResponseCacheService.name);
  private readonly redis: Redis | null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    const disabled =
      (config.get<string>('RESPONSE_CACHE') ?? '').toLowerCase() === 'off';
    this.redis =
      url && !disabled
        ? new Redis(url, {
            lazyConnect: false,
            // Never queue commands while disconnected: a miss is better than a wait.
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            connectTimeout: 2_000,
          })
        : null;
    this.redis?.on('error', (error: Error) => {
      this.logger.warn(`Response cache unavailable: ${error.message}`);
    });
  }

  get enabled(): boolean {
    return this.redis !== null && this.redis.status === 'ready';
  }

  private async generation(): Promise<string> {
    if (!this.redis) return '0';
    return (await withTimeout(this.redis.get(GENERATION_KEY), null)) ?? '0';
  }

  /** The key for a URL under the current generation, or null when off. */
  async keyFor(url: string): Promise<string | null> {
    if (!this.enabled) return null;
    return `rc:${await this.generation()}:${url}`;
  }

  async get(key: string): Promise<unknown> {
    if (!this.redis || !this.enabled) return undefined;
    const raw = await withTimeout(this.redis.get(key), null);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.redis || !this.enabled) return;
    await withTimeout(
      this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds),
      null,
    );
  }

  /**
   * Something changed: drop every cached public response and ask the website
   * to rebuild its cached pages.
   */
  async invalidate(): Promise<void> {
    if (this.redis && this.enabled) {
      await withTimeout(this.redis.incr(GENERATION_KEY), 0);
    }
    this.scheduleWebRefresh();
  }

  /*
    The website (on Vercel) keeps its own page cache. It exposes /revalidate,
    protected by a shared secret; calling it refreshes every page built from
    listing data, so an edit shows everywhere within seconds instead of
    waiting out the page's timer.
  */
  private scheduleWebRefresh() {
    const url = this.config.get<string>('WEB_REVALIDATE_URL');
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    if (!url || !secret) return;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      fetch(url, {
        method: 'POST',
        headers: { 'x-revalidate-secret': secret },
        signal: AbortSignal.timeout(5_000),
      })
        .then((response) => {
          if (!response.ok) {
            this.logger.warn(
              `Website refresh answered HTTP ${response.status}`,
            );
          }
        })
        .catch((error: Error) => {
          this.logger.warn(`Website refresh failed: ${error.message}`);
        });
    }, WEB_REFRESH_DEBOUNCE_MS);
    this.refreshTimer.unref?.();
  }

  async onModuleDestroy() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    await this.redis?.quit().catch(() => undefined);
  }
}
