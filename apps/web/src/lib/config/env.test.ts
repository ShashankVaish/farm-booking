import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getApiBaseUrl, getSiteUrl, publicEnv } from '@/lib/config/env';

// Comments are stripped so the doc comment explaining the pitfall does not
// itself trip the check below.
const envSource = readFileSync(resolve(__dirname, 'env.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

describe('public env access', () => {
  /**
   * Guards a regression that emptied every listing page: reading config via
   * `process.env[name]` is not replaced by the bundler, so the value is
   * undefined at runtime and `safeSearch` renders "no stays" with no error.
   */
  it('reads every NEXT_PUBLIC_ variable as a literal expression', () => {
    expect(envSource).not.toMatch(/process\.env\[/);
    for (const key of [
      'NEXT_PUBLIC_BRAND_NAME',
      'NEXT_PUBLIC_API_URL',
      'NEXT_PUBLIC_SITE_URL',
    ]) {
      expect(envSource).toContain(`process.env.${key}`);
    }
  });

  it('always has a brand name to fall back on', () => {
    expect(publicEnv.brandName.length).toBeGreaterThan(0);
  });

  it('resolves a usable API base URL on the server outside production', () => {
    // Vitest runs with NODE_ENV=test, so this exercises the dev fallback.
    const base = getApiBaseUrl();
    expect(base).toMatch(/^https?:\/\//);
    expect(base.endsWith('/')).toBe(false);
  });

  it('never returns a trailing slash from getSiteUrl', () => {
    expect(getSiteUrl().endsWith('/')).toBe(false);
  });
});
