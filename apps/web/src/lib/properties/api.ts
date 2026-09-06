import { apiClient } from '@/lib/api/client';
import { toQueryString } from '@/lib/api/query';
import { demoPropertyToApi } from '@/data/demo-properties';
import type {
  ApiProperty,
  ApiReview,
  AvailabilityDay,
  Paginated,
  SearchFilters,
} from '@/lib/properties/types';

function publicGet<T>(path: string): Promise<T> {
  return apiClient.get<T>(path, { auth: false });
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
    sort: filters.sort,
    page: filters.page ?? 1,
    limit: filters.limit ?? 12,
  });
  return publicGet<Paginated<ApiProperty>>(`/api/search${query}`);
}

export async function getProperty(id: string): Promise<ApiProperty> {
  try {
    return await publicGet<ApiProperty>(`/api/properties/${encodeURIComponent(id)}`);
  } catch (error) {
    const sample = demoPropertyToApi(id);
    if (sample) {
      return sample;
    }
    throw error;
  }
}

export function getPropertyReviews(id: string, page = 1): Promise<Paginated<ApiReview>> {
  return publicGet<Paginated<ApiReview>>(`/api/properties/${id}/reviews${toQueryString({ page, limit: 8 })}`);
}

export function getAvailability(propertyId: string, from: string, to: string): Promise<AvailabilityDay[]> {
  return publicGet<AvailabilityDay[]>(
    `/api/availability/${propertyId}${toQueryString({ from, to })}`,
  );
}

export async function safeSearch(filters: SearchFilters = {}): Promise<Paginated<ApiProperty>> {
  try {
    return await searchProperties(filters);
  } catch {
    return { items: [], meta: { total: 0, page: 1, limit: filters.limit ?? 12, totalPages: 0 } };
  }
}
