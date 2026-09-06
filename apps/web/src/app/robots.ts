import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/config/env';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl() || 'http://localhost:3000';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/auth/', '/dashboard/', '/admin/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
