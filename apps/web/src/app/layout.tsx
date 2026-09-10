import type { Metadata } from 'next';
import { Manrope, Playfair_Display } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import { brand } from '@/lib/config/brand';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import './globals.css';

// Body copy, UI and numerals.
const sans = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-family',
  display: 'swap',
});

// Headings and the wordmark.
const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
