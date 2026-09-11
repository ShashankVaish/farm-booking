/**
 * Public runtime config. Secrets must never be stored in NEXT_PUBLIC_ variables.
 *
 * Each variable is read as a *literal* `process.env.NEXT_PUBLIC_X` expression.
 * Next.js replaces those at build time; a dynamic lookup such as
 * `process.env[name]` is NOT replaced, so it silently reads `undefined` in any
 * bundle. Configuration lives in the repo-root `.env`, which `next.config.ts`
 * loads and forwards through its `env` block — that forwarding only lands on
 * literal reads. Keep these literal.
 */
function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value && value.length > 0) return value;
  }
  return '';
}

const isProduction = process.env.NODE_ENV === 'production';

export const publicEnv = {
  brandName: firstNonEmpty(process.env.NEXT_PUBLIC_BRAND_NAME, 'Baagly'),
  apiUrl: firstNonEmpty(process.env.NEXT_PUBLIC_API_URL),
  siteUrl: firstNonEmpty(process.env.NEXT_PUBLIC_SITE_URL),
} as const;

export function getApiBaseUrl(): string {
  // In the browser, call same-origin `/api` so Next can proxy to the backend.
  // That avoids CORS failures when the app is opened as localhost vs 127.0.0.1.
  if (typeof window !== 'undefined') {
    return '';
  }

  if (publicEnv.apiUrl) {
    return publicEnv.apiUrl.replace(/\/$/, '');
  }

  // Server-side rendering with no API URL configured. In development fall back
  // to the local API rather than throwing: a throw here is swallowed by the
  // callers' catch blocks and shows up as "no listings", which hides the real
  // cause. In production a missing URL is a genuine misconfiguration.
  if (isProduction) {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not configured. Set it in the repo-root .env.',
    );
  }
  return 'http://localhost:3001';
}

export function getSiteUrl(): string {
  return publicEnv.siteUrl.replace(/\/$/, '');
}
