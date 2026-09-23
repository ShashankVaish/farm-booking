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

const REFRESH_PATH = '/api/auth/refresh';

export function createApiClient(options: ClientOptions = {}) {
  const tokenStore = options.tokenStore ?? memoryTokenStore;
  const fetchImpl = options.fetchImpl ?? fetch;

  // One shared refresh at a time: several components can 401 at once after the
  // 15-minute access token expires, and each must not rotate the token again.
  let refreshing: Promise<string | null> | null = null;

  function resolveUrl(path: string): string {
    const baseUrl = (options.getBaseUrl ?? getApiBaseUrl)();
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async function refreshAccessToken(): Promise<string | null> {
    try {
      const response = await fetchImpl(resolveUrl(REFRESH_PATH), {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        return null;
      }
      const payload = (await response.json().catch(() => null)) as unknown;
      const data = isEnvelope(payload) && payload.success ? payload.data : payload;
      const token = (data as { accessToken?: string } | null)?.accessToken ?? null;
      tokenStore.setAccessToken?.(token);
      return token;
    } catch {
      return null;
    }
  }

  function refreshOnce(): Promise<string | null> {
    refreshing ??= refreshAccessToken().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function request<T>(
    path: string,
    requestOptions: RequestOptions = {},
    retryAfterRefresh = true,
  ): Promise<T> {
    const url = resolveUrl(path);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...requestOptions.headers,
    };

    const isFormData =
      typeof FormData !== 'undefined' && requestOptions.body instanceof FormData;

    if (requestOptions.body !== undefined && !isFormData) {
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
        credentials: 'include',
        body:
          requestOptions.body === undefined
            ? undefined
            : isFormData
              ? (requestOptions.body as FormData)
              : JSON.stringify(requestOptions.body),
        signal: requestOptions.signal,
      });
    } catch {
      throw new NetworkError();
    }

    // The access token lives 15 minutes; the refresh cookie lives 7 days. Trade
    // the cookie for a fresh token once and replay the call, so a long session
    // does not silently look logged out. FormData bodies are single-use streams,
    // so those are not replayed.
    if (
      response.status === 401 &&
      shouldAuth &&
      retryAfterRefresh &&
      !isFormData &&
      path !== REFRESH_PATH
    ) {
      const token = await refreshOnce();
      if (token) {
        return request<T>(path, requestOptions, false);
      }
      tokenStore.setAccessToken?.(null);
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

  /**
   * Fetches a file rather than JSON.
   *
   * `request` always parses the body as JSON, so it cannot carry a PDF. This
   * repeats only the auth and one-shot refresh around the call — the parts
   * that must not differ — and returns the bytes with the server's own file
   * name, taken from Content-Disposition so the two never disagree.
   */
  async function download(
    path: string,
    retryAfterRefresh = true,
  ): Promise<{ blob: Blob; fileName: string }> {
    const headers: Record<string, string> = { Accept: 'application/pdf' };
    const token = await tokenStore.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetchImpl(resolveUrl(path), {
        method: 'GET',
        headers,
        credentials: 'include',
      });
    } catch {
      throw new NetworkError();
    }

    if (response.status === 401 && retryAfterRefresh) {
      const refreshed = await refreshOnce();
      if (refreshed) {
        return download(path, false);
      }
      tokenStore.setAccessToken?.(null);
    }

    if (!response.ok) {
      // A failure still answers in the API's JSON envelope, so the message
      // reaching the user is the server's own rather than a status code.
      const payload = (await response.json().catch(() => null)) as unknown;
      if (isEnvelope(payload) && payload.success === false) {
        throw new ApiError(
          response.status,
          payload.error.code,
          payload.error.message,
          payload.error.details,
        );
      }
      throw new ApiError(response.status, 'REQUEST_FAILED', 'The file could not be downloaded.');
    }

    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return {
      blob: await response.blob(),
      fileName: match?.[1] ?? path.split('/').pop() ?? 'download',
    };
  }

  return {
    request,
    download,
    get: <T>(path: string, requestOptions?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...requestOptions, method: 'GET' }),
    post: <T>(path: string, body?: unknown, requestOptions?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...requestOptions, method: 'POST', body }),
    upload: <T>(path: string, body: FormData, requestOptions?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...requestOptions, method: 'POST', body }),
    patch: <T>(path: string, body?: unknown, requestOptions?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...requestOptions, method: 'PATCH', body }),
    put: <T>(path: string, body?: unknown, requestOptions?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...requestOptions, method: 'PUT', body }),
    delete: <T>(path: string, requestOptions?: Omit<RequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...requestOptions, method: 'DELETE' }),
  };
}

export const apiClient = createApiClient();
