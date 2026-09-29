import { ApiError, NetworkError } from './errors';

/*
  Telling "the backend is down" apart from "the backend said no".

  The API wraps every response it sends — errors included — in its
  `{ success, … }` envelope. So a 5xx that arrives WITHOUT the envelope did not
  come from the API: it came from the proxy in front of it (Caddy, Nginx, the
  Vercel/Next rewrite) because the API was unreachable. That, a request that
  never got an answer at all, or a gateway status (502/503/504), is what counts
  as the server being down. An enveloped error, even a 500 or 503, is the API
  working and reporting a real problem, and is never shown as maintenance.
*/

export const MAINTENANCE_MESSAGE =
  "We're doing some quick maintenance. Please try again in a few minutes.";

/** Thrown by server-side data loaders when the API cannot be reached. */
export class ServiceUnavailableError extends Error {
  constructor(message = MAINTENANCE_MESSAGE) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

const GATEWAY_STATUSES = new Set([502, 503, 504]);

export function isServiceUnavailable(error: unknown): boolean {
  if (error instanceof ServiceUnavailableError || error instanceof NetworkError) return true;
  if (error instanceof ApiError) {
    return error.code === 'SERVICE_UNAVAILABLE' || (GATEWAY_STATUSES.has(error.status) && error.code === 'REQUEST_FAILED');
  }
  return false;
}

// --- Browser-side status, for the maintenance screen -----------------------

export const API_STATUS_EVENT = 'baagly:api-status';

let lastReported: boolean | null = null;

/**
 * Tells the maintenance screen whether the last API call reached the API.
 * Only dispatches on a change, so a busy page is not flooding listeners.
 * A no-op on the server.
 */
export function reportApiStatus(up: boolean): void {
  if (typeof window === 'undefined') return;
  if (lastReported === up) return;
  lastReported = up;
  window.dispatchEvent(new CustomEvent<boolean>(API_STATUS_EVENT, { detail: up }));
}

/** Resets the change detector; for tests and after the screen recovers. */
export function resetApiStatus(): void {
  lastReported = null;
}

/**
 * Asks the API's health route whether it is answering. Goes through the
 * site's own `/health` rewrite, so it checks exactly the path real requests
 * take. Never throws.
 */
export async function checkApiHealth(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<boolean> {
  try {
    const response = await fetchImpl('/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}
