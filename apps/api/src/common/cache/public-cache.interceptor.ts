import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { ResponseCacheService } from './response-cache.service';

/*
  What is cached, for how long in Redis (server) and in the browser/CDN
  (client). Only anonymous GETs: a signed-in request carries an Authorization
  header and may see drafts or its own data, so it always goes to the
  database and is never stored. Availability and prices are deliberately
  absent — they have to be exact at the moment of booking.
*/
type Rule = { pattern: RegExp; serverTtl: number; browserTtl: number };

export const CACHE_RULES: Rule[] = [
  { pattern: /^\/api\/search(\?|$)/, serverTtl: 60, browserTtl: 30 },
  { pattern: /^\/api\/properties(\?|$)/, serverTtl: 60, browserTtl: 30 },
  {
    pattern: /^\/api\/properties\/[^/?]+\/reviews(\?|$)/,
    serverTtl: 300,
    browserTtl: 60,
  },
  {
    pattern: /^\/api\/properties\/[^/?]+(\?|$)/,
    serverTtl: 300,
    browserTtl: 60,
  },
  { pattern: /^\/api\/amenities(\?|$)/, serverTtl: 3600, browserTtl: 600 },
  {
    pattern: /^\/api\/subscription-plans(\?|$)/,
    serverTtl: 600,
    browserTtl: 300,
  },
];

/**
 * Writes that change nothing a guest can see, so they leave the cache alone.
 * Everything else that succeeds (a listing edit, a moderation, a booking, a
 * payment webhook, a review) invalidates it.
 */
const QUIET_WRITES: RegExp[] = [
  /^\/api\/auth\//,
  /^\/api\/notifications/,
  /^\/api\/wishlist/,
  /^\/api\/bookings\/quote/,
  /^\/api\/locations\//,
  /^\/api\/media\//,
  /^\/api\/support/,
];

export function cacheRuleFor(url: string): Rule | null {
  // The own-listings route sits under /api/properties but is personal.
  if (/^\/api\/properties\/mine(\/|\?|$)/.test(url)) return null;
  return CACHE_RULES.find((rule) => rule.pattern.test(url)) ?? null;
}

export function isQuietWrite(url: string): boolean {
  return QUIET_WRITES.some((pattern) => pattern.test(url));
}

type HttpRequest = {
  method: string;
  originalUrl?: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
};
type HttpResponse = {
  setHeader(name: string, value: string): void;
  statusCode: number;
};

@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  constructor(private readonly cache: ResponseCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<HttpResponse>();
    const url = request.originalUrl ?? request.url;
    const method = request.method.toUpperCase();

    // Writes: once one succeeds, everything cached may be out of date.
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      if (isQuietWrite(url)) return next.handle();
      return next.handle().pipe(
        tap(() => {
          void this.cache.invalidate();
        }),
      );
    }

    const rule = method === 'GET' ? cacheRuleFor(url) : null;
    if (!rule || request.headers.authorization) return next.handle();

    // Browsers and CDNs may reuse the answer briefly, and serve it slightly
    // stale while they fetch a fresh one. Personal requests never match here.
    response.setHeader(
      'Cache-Control',
      `public, max-age=${rule.browserTtl}, stale-while-revalidate=${rule.browserTtl * 5}`,
    );
    response.setHeader('Vary', 'Authorization');

    return from(this.cache.keyFor(url)).pipe(
      switchMap((key) => {
        if (!key) return next.handle();
        return from(this.cache.get(key)).pipe(
          switchMap((hit) => {
            if (hit !== undefined) {
              response.setHeader('X-Cache', 'HIT');
              return of(hit);
            }
            response.setHeader('X-Cache', 'MISS');
            return next.handle().pipe(
              tap((body) => {
                if (response.statusCode === 200 && body !== undefined) {
                  void this.cache.set(key, body, rule.serverTtl);
                }
              }),
            );
          }),
        );
      }),
    );
  }
}
