import { ExploreFilters, type ExploreQuery } from '@/components/hospitality/explore-filters';
import { ExploreResults } from '@/components/hospitality/explore-results';
import { apiClient } from '@/lib/api/client';
import { safeSearch } from '@/lib/properties/api';
import { toPropertyCard } from '@/lib/properties/map-property';
import type { ApiAmenity, SearchFilters } from '@/lib/properties/types';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Explore stays',
  path: '/explore',
  description: 'Search private farmhouses, villas, and party venues across India.',
});

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query: ExploreQuery = {
    location: first(params.location),
    city: first(params.city),
    checkIn: first(params.checkIn),
    checkOut: first(params.checkOut),
    guests: first(params.guests),
    minPrice: first(params.minPrice),
    maxPrice: first(params.maxPrice),
    bedrooms: first(params.bedrooms),
    bathrooms: first(params.bathrooms),
    pool: first(params.pool),
    partyAllowed: first(params.partyAllowed),
    minRating: first(params.minRating),
    sort: first(params.sort),
    propertyType: first(params.propertyType),
    amenities: first(params.amenities),
  };

  const filters: SearchFilters = {
    location: query.location,
    city: query.city,
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    guests: query.guests ? Number(query.guests) : undefined,
    minPrice: query.minPrice ? Number(query.minPrice) : undefined,
    maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
    bedrooms: query.bedrooms ? Number(query.bedrooms) : undefined,
    bathrooms: query.bathrooms ? Number(query.bathrooms) : undefined,
    pool: query.pool === 'true',
    partyAllowed: query.partyAllowed === 'true',
    minRating: query.minRating ? Number(query.minRating) : undefined,
    sort: query.sort,
    propertyType: query.propertyType,
    amenities: query.amenities,
    page: 1,
    limit: 12,
  };

  const [result, amenities] = await Promise.all([
    safeSearch(filters),
    apiClient.get<ApiAmenity[]>('/api/amenities', { auth: false }).catch(() => [] as ApiAmenity[]),
  ]);

  return (
    <section className="container" style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
      <p className="t-label">Explore</p>
      <h1 className="t-h1">Find a private stay</h1>
      <div style={{ marginTop: 'var(--space-6)' }}>
        <ExploreFilters query={query} amenities={amenities} />
      </div>
      <div style={{ marginTop: 'var(--space-8)' }}>
        <ExploreResults initial={result.items.map(toPropertyCard)} total={result.meta.total} filters={filters} />
      </div>
    </section>
  );
}
