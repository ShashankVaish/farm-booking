import type { Metadata } from 'next';
import { brand } from '@/lib/config/brand';
import { getSiteUrl } from '@/lib/config/env';

type PageMeta = {
  title: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description = brand.shortDescription,
  path = '/',
  noIndex = false,
}: PageMeta): Metadata {
  const siteUrl = getSiteUrl();
  const canonical = siteUrl ? `${siteUrl}${path}` : path;
  const fullTitle = title === brand.name ? brand.name : `${title} · ${brand.name}`;

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: brand.name,
      locale: 'en_IN',
      type: 'website',
    },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}
