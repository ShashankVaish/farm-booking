import { apiClient } from '@/lib/api/client';
import { toQueryString } from '@/lib/api/query';
import type { AuthUser, AvailabilityDay, Paginated, ApiProperty, ApiReview } from '@/lib/properties/types';

export type OwnerOverview = {
  propertyCount: number;
  pendingApproval: number;
  bookingCount: number;
  grossAmount: string;
  platformFees: string;
  netAmount: string;
  occupancy: number;
  reviewCount: number;
  averageRating: number;
  unreadNotifications: number;
  upcomingBookings: Array<{
    id: string;
    checkInDate: string;
    checkOutDate: string;
    status: string;
    property: { id: string; title: string };
  }>;
  propertyStatus: Array<{ status: string; count: number }>;
};

export type OwnerProperty = ApiProperty & {
  status: string;
  createdAt?: string;
};

export type OwnerBooking = {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  totalAmount: string | number;
  property: { id: string; title: string };
  customer: { id: string; name: string; email: string };
};

export type PlaceSuggestion = {
  displayName: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude: number;
  longitude: number;
};

export type ConfirmedLocation = PlaceSuggestion & {
  location: string;
  confirmed: boolean;
};

export type AmenityRecord = { id: string; name: string; slug: string };

export type OwnerProfile = AuthUser & {
  ownerProfile?: {
    businessName?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
    kycVerified?: boolean;
  } | null;
};

export type HostNotification = {
  id: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export const hostApi = {
  me: () => apiClient.get<AuthUser>('/api/auth/me'),
  overview: () => apiClient.get<OwnerOverview>('/api/owner/overview'),
  properties: (page = 1) =>
    apiClient.get<Paginated<OwnerProperty>>(`/api/owner/properties${toQueryString({ page, limit: 20 })}`),
  bookings: (page = 1) =>
    apiClient.get<Paginated<OwnerBooking>>(`/api/owner/bookings${toQueryString({ page, limit: 20 })}`),
  earnings: () => apiClient.get<OwnerOverview>('/api/owner/earnings'),
  reviews: (page = 1) =>
    apiClient.get<Paginated<ApiReview & { property?: { id: string; title: string } }>>(
      `/api/owner/reviews${toQueryString({ page, limit: 20 })}`,
    ),
  profile: () => apiClient.get<OwnerProfile>('/api/owner/profile'),
  updateProfile: (body: { name?: string; businessName?: string; gstNumber?: string; panNumber?: string }) =>
    apiClient.patch<OwnerProfile>('/api/owner/profile', body),
  notifications: () =>
    apiClient.get<Paginated<HostNotification>>(`/api/notifications${toQueryString({ page: 1, limit: 8 })}`),
  markNotificationRead: (id: string) => apiClient.post(`/api/notifications/${id}/read`),
  amenities: () => apiClient.get<AmenityRecord[]>('/api/amenities', { auth: false }),
  searchPlaces: (q: string) =>
    apiClient.get<PlaceSuggestion[]>(`/api/locations/search${toQueryString({ q })}`),
  reverseGeocode: (latitude: number, longitude: number) =>
    apiClient.post<PlaceSuggestion>('/api/locations/reverse', { latitude, longitude }),
  confirmLocation: (body: Record<string, unknown>) =>
    apiClient.post<ConfirmedLocation>('/api/locations/confirm', body),
  createProperty: (body: Record<string, unknown>) => apiClient.post<ApiProperty>('/api/properties', body),
  updateProperty: (id: string, body: Record<string, unknown>) =>
    apiClient.patch<ApiProperty>(`/api/properties/${id}`, body),
  getProperty: (id: string) => apiClient.get<ApiProperty>(`/api/properties/${id}`),
  availability: (propertyId: string, from: string, to: string) =>
    apiClient.get<AvailabilityDay[]>(`/api/availability/${propertyId}${toQueryString({ from, to })}`),
  blockDates: (propertyId: string, dates: string[], notes?: string) =>
    apiClient.post(`/api/availability/${propertyId}/block`, { dates, notes }),
  unblockDates: (propertyId: string, dates: string[]) =>
    apiClient.post(`/api/availability/${propertyId}/unblock`, { dates }),
  completeBooking: (id: string) => apiClient.post(`/api/bookings/${id}/complete`),
};
