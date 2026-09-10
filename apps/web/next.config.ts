import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

/**
 * Configuration for the whole monorepo lives in a single `.env` at the repo
 * root. Next only auto-loads `.env` files from the app directory, so the root
 * file is read here — before the config object is built — and merged into
 * process.env. Values already set in the real environment win, so CI and
 * container deployments can still override without editing the file.
 *
 * A tiny parser is used on purpose: adding `dotenv` just to read one file
 * would put a dependency in the build path for no real gain.
 */
function loadRootEnv(): void {
  const envPath = resolve(__dirname, '../../.env');
  let contents: string;
  try {
    contents = readFileSync(envPath, 'utf8');
  } catch {
    // No root .env (e.g. a deployment injecting real env vars) — nothing to do.
    return;
  }

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;

    let value = line.slice(separator + 1).trim();
    // Strip matching surrounding quotes, keeping any inside the value.
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadRootEnv();

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Inlined into the browser bundle. Read from the root .env above, since Next
  // would otherwise only see variables defined inside apps/web.
  env: {
    NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Baagly',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
      { source: '/uploads/:path*', destination: `${apiOrigin}/uploads/:path*` },
      { source: '/health', destination: `${apiOrigin}/health` },
    ];
  },
};

export default nextConfig;
