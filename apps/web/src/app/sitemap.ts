import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/config/env';
import { safeSearch } from '@/lib/properties/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl() || 'http://localhost:3000';
  const staticRoutes = ['', '/explore', '/map', '/host'].map((path) => ({
    url: `${siteUrl}${path || '/'}`,
    changeFrequency: 'daily' as const,
    priority: path === '' ? 1 : 0.8,
  }));

  // Legal pages change rarely but must be discoverable: payment providers and
  // reviewers look for them at plain addresses.
  const legalRoutes = ['/terms', '/terms/guest', '/terms/host', '/privacy', '/refund-policy', '/shipping-and-returns'].map(
    (path) => ({
      url: `${siteUrl}${path}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    }),
  );

  const listed = await safeSearch({ limit: 50, sort: 'newest' });
  const properties = listed.items.map((property) => ({
    url: `${siteUrl}/properties/${property.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...legalRoutes, ...properties];
}
