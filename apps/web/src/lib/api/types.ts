export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  auth?: boolean;
  /**
   * Next.js data-cache hint for server-side fetches, e.g. `{ revalidate: 3600 }`
   * for data that rarely changes. Ignored in the browser.
   */
  next?: { revalidate?: number | false; tags?: string[] };
  /** Abort after this long. Defaults to 10 s for requests made on the server. */
  timeoutMs?: number;
};
