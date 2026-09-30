import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import {
  PublicCacheInterceptor,
  cacheRuleFor,
  isQuietWrite,
} from './public-cache.interceptor';
import type { ResponseCacheService } from './response-cache.service';

function fakeCache(stored?: unknown) {
  return {
    keyFor: jest.fn((url: string) => Promise.resolve(`rc:0:${url}`)),
    get: jest.fn(() => Promise.resolve(stored)),
    set: jest.fn(() => Promise.resolve()),
    invalidate: jest.fn(() => Promise.resolve()),
  };
}

function context(
  method: string,
  url: string,
  headers: Record<string, string> = {},
) {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  const ctx = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method, url, originalUrl: url, headers }),
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  return { ctx, response };
}

function handler(value: unknown): CallHandler & { handle: jest.Mock } {
  return { handle: jest.fn(() => of(value)) };
}

describe('cache rules', () => {
  it('caches public reads only', () => {
    expect(cacheRuleFor('/api/search?city=Goa')).not.toBeNull();
    expect(cacheRuleFor('/api/properties/abc')).not.toBeNull();
    expect(cacheRuleFor('/api/properties/abc/reviews?page=2')).not.toBeNull();
    expect(cacheRuleFor('/api/amenities')).not.toBeNull();
    // Must be exact at booking time.
    expect(cacheRuleFor('/api/availability/abc?from=2026-10-01')).toBeNull();
    expect(cacheRuleFor('/api/bookings/my')).toBeNull();
    expect(cacheRuleFor('/api/properties/mine')).toBeNull();
  });

  it('lets sign-ins and quotes through without clearing the cache', () => {
    expect(isQuietWrite('/api/auth/otp/request')).toBe(true);
    expect(isQuietWrite('/api/bookings/quote')).toBe(true);
    expect(isQuietWrite('/api/properties/abc')).toBe(false);
    expect(isQuietWrite('/api/admin/properties/abc/approve')).toBe(false);
  });
});

describe('PublicCacheInterceptor', () => {
  it('serves a hit without touching the database', async () => {
    const cache = fakeCache({ id: 'p1', title: 'Cached' });
    const next = handler({ id: 'p1', title: 'Fresh' });
    const { ctx, response } = context('GET', '/api/properties/p1');
    const result = await lastValueFrom(
      new PublicCacheInterceptor(
        cache as unknown as ResponseCacheService,
      ).intercept(ctx, next),
    );
    expect(result).toEqual({ id: 'p1', title: 'Cached' });
    expect(next.handle).not.toHaveBeenCalled();
    expect(response.headers['X-Cache']).toBe('HIT');
    expect(response.headers['Cache-Control']).toMatch(/^public, max-age=\d+/);
  });

  it('stores a miss for the next visitor', async () => {
    const cache = fakeCache(undefined);
    const { ctx } = context('GET', '/api/search?city=Goa');
    await lastValueFrom(
      new PublicCacheInterceptor(
        cache as unknown as ResponseCacheService,
      ).intercept(ctx, handler({ items: [] })),
    );
    expect(cache.set).toHaveBeenCalledWith(
      'rc:0:/api/search?city=Goa',
      { items: [] },
      60,
    );
  });

  it('never caches a signed-in request', async () => {
    const cache = fakeCache({ stale: true });
    const next = handler({ fresh: true });
    const { ctx, response } = context('GET', '/api/properties/p1', {
      authorization: 'Bearer x',
    });
    const result = await lastValueFrom(
      new PublicCacheInterceptor(
        cache as unknown as ResponseCacheService,
      ).intercept(ctx, next),
    );
    expect(result).toEqual({ fresh: true });
    expect(cache.get).not.toHaveBeenCalled();
    expect(response.headers['Cache-Control']).toBeUndefined();
  });

  it('clears everything after a successful write, not after a failed one', async () => {
    const cache = fakeCache();
    const interceptor = new PublicCacheInterceptor(
      cache as unknown as ResponseCacheService,
    );

    await lastValueFrom(
      interceptor.intercept(
        context('PATCH', '/api/properties/p1').ctx,
        handler({ ok: true }),
      ),
    );
    expect(cache.invalidate).toHaveBeenCalledTimes(1);

    const failing = {
      handle: jest.fn(() => throwError(() => new Error('nope'))),
    };
    await expect(
      lastValueFrom(
        interceptor.intercept(
          context('PATCH', '/api/properties/p1').ctx,
          failing,
        ),
      ),
    ).rejects.toThrow();
    expect(cache.invalidate).toHaveBeenCalledTimes(1);

    await lastValueFrom(
      interceptor.intercept(
        context('POST', '/api/auth/login').ctx,
        handler({ ok: true }),
      ),
    );
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });
});
