import { apiClient } from '@/lib/api/client';
import { toQueryString } from '@/lib/api/query';
import { isServiceUnavailable, ServiceUnavailableError } from '@/lib/api/availability';
import type {
  ApiProperty,
  ApiReview,
  AvailabilityDay,
  Paginated,
  SearchFilters,
} from '@/lib/properties/types';

/*
  Every page built from listing data is tagged "properties". On the server
  (Vercel) these reads are kept in Next's data cache for `revalidate` seconds
  and dropped at once when the API calls /revalidate after a change; in the
  browser the `next` option is simply ignored.
*/
export const PROPERTIES_TAG = 'properties';

function publicGet<T>(path: string, revalidate?: number): Promise<T> {
  return apiClient.get<T>(path, {
    auth: false,
    ...(revalidate ? { next: { revalidate, tags: [PROPERTIES_TAG] } } : {}),
  });
}

export async function searchProperties(filters: SearchFilters = {}): Promise<Paginated<ApiProperty>> {
  const query = toQueryString({
    city: filters.city,
    state: filters.state,
    location: filters.location,
    propertyType: filters.propertyType,
    guests: filters.guests,
    bedrooms: filters.bedrooms,
    bathrooms: filters.bathrooms,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    amenities: filters.amenities,
    checkIn: filters.checkIn,
    checkOut: filters.checkOut,
    partyFriendly: filters.partyFriendly,
    partyAllowed: filters.partyAllowed,
    pool: filters.pool,
    minRating: filters.minRating,
    trusted: filters.trusted,
    sort: filters.sort,
    page: filters.page ?? 1,
    limit: filters.limit ?? 12,
  });
  return publicGet<Paginated<ApiProperty>>(`/api/search${query}`, 60);
}

export function getProperty(id: string): Promise<ApiProperty> {
  // No placeholder fallback here: a listing that cannot be loaded must surface
  // as not-found rather than rendering a fabricated, bookable-looking stay.
  return publicGet<ApiProperty>(`/api/properties/${encodeURIComponent(id)}`, 300);
}

export function getPropertyReviews(id: string, page = 1): Promise<Paginated<ApiReview>> {
  return publicGet<Paginated<ApiReview>>(`/api/properties/${id}/reviews${toQueryString({ page, limit: 8 })}`, 300);
}

export function getAvailability(propertyId: string, from: string, to: string): Promise<AvailabilityDay[]> {
  return publicGet<AvailabilityDay[]>(
    `/api/availability/${propertyId}${toQueryString({ from, to })}`,
  );
}

/**
 * Search that degrades to an empty result instead of failing the page.
 *
 * The failure is logged rather than swallowed: an empty list is
 * indistinguishable from "the catalogue is genuinely empty", so without this a
 * misconfigured API URL or a down backend renders as "No stays are live yet"
 * with nothing anywhere to explain it.
 */
export async function safeSearch(filters: SearchFilters = {}): Promise<Paginated<ApiProperty>> {
  try {
    return await searchProperties(filters);
  } catch (error) {
    // The backend is down: show the maintenance screen (via the error
    // boundary), not an empty catalogue that reads as "no stays exist".
    if (isServiceUnavailable(error)) {
      throw new ServiceUnavailableError();
    }
    console.error(
      '[safeSearch] property search failed, rendering an empty catalogue:',
      error instanceof Error ? error.message : error,
    );
    return { items: [], meta: { total: 0, page: 1, limit: filters.limit ?? 12, totalPages: 0 } };
  }
}
