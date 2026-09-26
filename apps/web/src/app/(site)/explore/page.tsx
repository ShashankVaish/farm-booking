import { ExploreFilters, type ExploreQuery } from '@/components/hospitality/explore-filters';
import { ExploreResults } from '@/components/hospitality/explore-results';
import { apiClient } from '@/lib/api/client';
import { safeSearch } from '@/lib/properties/api';
import { toPropertyCard } from '@/lib/properties/map-property';
import type { ApiAmenity, SearchFilters } from '@/lib/properties/types';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import { positiveInt, positiveNumber } from '@/lib/properties/search-params';

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
    // A hand-edited or stale link ("guests=0", "guests=abc") used to reach the
    // API as-is; it refused the whole search and the page showed no stays.
    // Anything that is not a positive whole number is dropped instead.
    guests: positiveInt(query.guests),
    minPrice: positiveInt(query.minPrice),
    maxPrice: positiveInt(query.maxPrice),
    bedrooms: positiveInt(query.bedrooms),
    bathrooms: positiveInt(query.bathrooms),
    // Must stay undefined when unchecked. `false` survives toQueryString and
    // reaches the API as `pool=false`, which excludes every stay.
    pool: query.pool === 'true' ? true : undefined,
    partyAllowed: query.partyAllowed === 'true' ? true : undefined,
    minRating: positiveNumber(query.minRating),
    sort: query.sort,
    propertyType: query.propertyType,
    amenities: query.amenities,
    page: 1,
    limit: 12,
  };

  const [result, amenities] = await Promise.all([
    safeSearch(filters),
    // The amenity list changes only when an admin edits it; no need to fetch
    // it again on every search.
    apiClient
      .get<ApiAmenity[]>('/api/amenities', { auth: false, next: { revalidate: 600 } })
      .catch(() => [] as ApiAmenity[]),
  ]);

  return (
    <section className="container" style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
      <p className="t-label">Explore</p>
      <h1 className="t-h1">Find a private stay</h1>
      <div style={{ marginTop: 'var(--space-6)' }}>
        <ExploreFilters query={query} amenities={amenities} />
      </div>
      <div style={{ marginTop: 'var(--space-8)' }}>
        {/*
          ExploreResults seeds its list and page number from props. Without a key
          tied to the active filters, React keeps the old state on navigation and
          the grid keeps showing the previous search under a fresh result count.
        */}
        <ExploreResults
          key={JSON.stringify(filters)}
          initial={result.items.map(toPropertyCard)}
          total={result.meta.total}
          filters={filters}
        />
      </div>
    </section>
  );
}
