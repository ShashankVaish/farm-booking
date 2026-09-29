import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api/client';
import { ApiError, NetworkError } from '@/lib/api/errors';
import {
  API_STATUS_EVENT,
  ServiceUnavailableError,
  checkApiHealth,
  isServiceUnavailable,
  reportApiStatus,
  resetApiStatus,
} from './availability';

afterEach(() => {
  resetApiStatus();
  vi.unstubAllGlobals();
});

describe('what counts as the server being down', () => {
  it('a request that got no answer, or a gateway error from the proxy', () => {
    expect(isServiceUnavailable(new NetworkError())).toBe(true);
    expect(isServiceUnavailable(new ServiceUnavailableError())).toBe(true);
    expect(isServiceUnavailable(new ApiError(502, 'REQUEST_FAILED', 'x'))).toBe(true);
    expect(isServiceUnavailable(new ApiError(504, 'SERVICE_UNAVAILABLE', 'x'))).toBe(true);
  });

  it("never the API's own errors, even a 500 or 503", () => {
    expect(isServiceUnavailable(new ApiError(500, 'INTERNAL_ERROR', 'x'))).toBe(false);
    expect(isServiceUnavailable(new ApiError(503, 'PAYMENT_PROVIDER_ERROR', 'x'))).toBe(false);
    expect(isServiceUnavailable(new ApiError(404, 'NOT_FOUND', 'x'))).toBe(false);
    expect(isServiceUnavailable(new Error('bug'))).toBe(false);
  });
});

describe('the API client flags an outage', () => {
  function client(fetchImpl: ReturnType<typeof vi.fn>) {
    return createApiClient({
      getBaseUrl: () => 'http://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      tokenStore: { getAccessToken: () => null },
    });
  }

  it('turns a proxy 502 (no API envelope) into a maintenance error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('HTML, not JSON');
      },
    });
    await expect(client(fetchImpl).get('/api/search')).rejects.toMatchObject({
      status: 502,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it("leaves the API's own enveloped errors alone", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: { code: 'PAYMENT_PROVIDER_ERROR', message: 'PhonePe is not responding' },
      }),
    });
    await expect(client(fetchImpl).get('/api/payments')).rejects.toMatchObject({
      code: 'PAYMENT_PROVIDER_ERROR',
    });
  });
});

describe('reporting status to the maintenance screen', () => {
  it('dispatches only when the status changes', () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    reportApiStatus(false);
    reportApiStatus(false);
    reportApiStatus(true);
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    expect((dispatchEvent.mock.calls[0][0] as CustomEvent).type).toBe(API_STATUS_EVENT);
    expect((dispatchEvent.mock.calls[0][0] as CustomEvent).detail).toBe(false);
    expect((dispatchEvent.mock.calls[1][0] as CustomEvent).detail).toBe(true);
  });

  it('does nothing on the server', () => {
    expect(() => reportApiStatus(false)).not.toThrow();
  });
});

describe('checkApiHealth', () => {
  it('is healthy only when /health answers OK', async () => {
    await expect(checkApiHealth(vi.fn().mockResolvedValue({ ok: true }) as never)).resolves.toBe(true);
    await expect(checkApiHealth(vi.fn().mockResolvedValue({ ok: false }) as never)).resolves.toBe(false);
    await expect(
      checkApiHealth(vi.fn().mockRejectedValue(new TypeError('fetch failed')) as never),
    ).resolves.toBe(false);
  });
});
