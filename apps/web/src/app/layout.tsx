import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import { brand } from '@/lib/config/brand';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import './globals.css';

// Body copy, UI and numerals.
const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-family',
  display: 'swap',
});

/*
  Headings and the wordmark.

  Fraunces is a variable font with an optical-size axis: at display sizes it
  wants far less of the softness it needs at small ones. `opsz` is pinned near
  the top of its range so headings pick up the sharper, more deliberate cut
  rather than the chunky text-size default, and SOFT/WONK are left at their
  defaults — dialling those up makes it novelty rather than hospitality.
*/
const display = Fraunces({
  subsets: ['latin'],
  // Must be 'variable' rather than a weight list: next/font rejects `axes`
  // alongside explicit weights. It also gives headings the full weight range
  // instead of four fixed cuts.
  weight: 'variable',
  axes: ['opsz'],
  variable: '--font-display-family',
  display: 'swap',
});

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: brand.name,
    description: brand.shortDescription,
    path: '/',
  }),
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body className={`${sans.variable} ${display.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
