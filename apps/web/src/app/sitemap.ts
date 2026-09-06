import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/config/env';
import { safeSearch } from '@/lib/properties/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl() || 'http://localhost:3000';
  const staticRoutes = ['', '/explore', '/stays', '/experiences', '/events', '/host'].map((path) => ({
    url: `${siteUrl}${path || '/'}`,
    changeFrequency: 'daily' as const,
    priority: path === '' ? 1 : 0.8,
  }));

  const listed = await safeSearch({ limit: 50, sort: 'newest' });
  const properties = listed.items.map((property) => ({
    url: `${siteUrl}/properties/${property.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...properties];
}
