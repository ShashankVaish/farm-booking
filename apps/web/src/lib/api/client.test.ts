import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api/client';
import { NetworkError } from '@/lib/api/errors';

describe('createApiClient', () => {
  it('unwraps successful API envelopes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { status: 'ok' } }),
    });

    const client = createApiClient({
      getBaseUrl: () => 'http://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      tokenStore: { getAccessToken: () => 'token-1' },
    });

    const result = await client.get<{ status: string }>('/health');
    expect(result).toEqual({ status: 'ok' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api.test/health',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-1',
        }),
      }),
    );
  });

  it('maps envelope failures to ApiError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Sign in required' },
      }),
    });

    const client = createApiClient({
      getBaseUrl: () => 'http://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.get('/api/auth/me')).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        code: 'UNAUTHORIZED',
        status: 401,
      }),
    );
  });

  it('maps fetch failures to NetworkError', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const client = createApiClient({
      getBaseUrl: () => 'http://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.get('/health')).rejects.toBeInstanceOf(NetworkError);
  });

  it('sends FormData without forcing JSON content type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { url: '/uploads/a.jpg' } }),
    });
    const client = createApiClient({
      getBaseUrl: () => 'http://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      tokenStore: { getAccessToken: () => 'token-1' },
    });
    const body = new FormData();
    body.append('file', new Blob(['x'], { type: 'image/jpeg' }), 'x.jpg');
    await client.upload('/api/media', body);
    const options = fetchImpl.mock.calls[0][1] as RequestInit;
    expect((options.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(options.body).toBe(body);
  });
});

describe('createApiClient timeouts and caching', () => {
  function client(fetchImpl: ReturnType<typeof vi.fn>) {
    return createApiClient({
      getBaseUrl: () => 'http://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      tokenStore: { getAccessToken: () => null },
    });
  }

  const ok = () =>
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });

  it('gives a request a deadline, so a stuck API cannot hold a page forever', async () => {
    const fetchImpl = ok();
    await client(fetchImpl).get('/api/search', { timeoutMs: 5000 });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports a timed-out request as a network error', async () => {
    const fetchImpl = vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'TimeoutError')));
      });
    });
    await expect(client(fetchImpl).get('/api/search', { timeoutMs: 20 })).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it("keeps the caller's own abort signal", async () => {
    const fetchImpl = ok();
    const controller = new AbortController();
    await client(fetchImpl).get('/api/search', { signal: controller.signal, timeoutMs: 5000 });
    expect((fetchImpl.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal);
  });

  it('passes Next cache hints through to fetch', async () => {
    const fetchImpl = ok();
    await client(fetchImpl).get('/api/amenities', { next: { revalidate: 600 } });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ next: { revalidate: 600 } });
  });
});
