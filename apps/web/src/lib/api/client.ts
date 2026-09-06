import { getApiBaseUrl } from '@/lib/config/env';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { memoryTokenStore, type TokenStore } from '@/lib/api/token-store';
import type { ApiEnvelope, RequestOptions } from '@/lib/api/types';

type ClientOptions = {
  getBaseUrl?: () => string;
  tokenStore?: TokenStore;
  fetchImpl?: typeof fetch;
};

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value;
}

export function createApiClient(options: ClientOptions = {}) {
  const tokenStore = options.tokenStore ?? memoryTokenStore;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const baseUrl = (options.getBaseUrl ?? getApiBaseUrl)();
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...requestOptions.headers,
    };

    if (requestOptions.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const shouldAuth = requestOptions.auth !== false;
    if (shouldAuth) {
      const token = await tokenStore.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: requestOptions.method ?? 'GET',
        headers,
        body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
        signal: requestOptions.signal,
      });
    } catch {
      throw new NetworkError();
    }

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      if (isEnvelope(payload) && payload.success === false) {
        throw new ApiError(
          response.status,
          payload.error.code,
          payload.error.message,
          payload.error.details,
        );
      }
      throw new ApiError(response.status, 'REQUEST_FAILED', 'The request could not be completed.');
    }

    if (isEnvelope(payload)) {
      if (!payload.success) {
        throw new ApiError(response.status, payload.error.code, payload.error.message, payload.error.details);
      }
      return payload.data as T;
    }

    return payload as T;
  }

  return {
    request,
    get: <T>(path: string, requestOptions?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...requestOptions, method: 'GET' }),
    post: <T>(path: string, body?: unknown, requestOptions?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...requestOptions, method: 'POST', body }),
  };
}

export const apiClient = createApiClient();
