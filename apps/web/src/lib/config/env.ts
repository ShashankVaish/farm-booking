function readPublic(name: string, fallback = ''): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

/**
 * Public runtime config. Secrets must never be stored in NEXT_PUBLIC_ variables.
 * Base URLs live here so pages and components do not hardcode hosts.
 */
export const publicEnv = {
  brandName: readPublic('NEXT_PUBLIC_BRAND_NAME', 'BRAND_NAME'),
  apiUrl: readPublic('NEXT_PUBLIC_API_URL'),
  siteUrl: readPublic('NEXT_PUBLIC_SITE_URL'),
} as const;

export function getApiBaseUrl(): string {
  if (!publicEnv.apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured.');
  }
  return publicEnv.apiUrl.replace(/\/$/, '');
}

export function getSiteUrl(): string {
  return publicEnv.siteUrl.replace(/\/$/, '');
}
