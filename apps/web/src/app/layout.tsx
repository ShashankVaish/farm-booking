import type { Metadata } from 'next';
import { Instrument_Sans, Instrument_Serif } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import { brand } from '@/lib/config/brand';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import './globals.css';

const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans-family',
  display: 'swap',
});

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
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
