import { apiClient } from '@/lib/api/client';
import { toQueryString } from '@/lib/api/query';
import type { Paginated } from '@/lib/properties/types';
import type { CustomerBooking, PaymentOrder, PriceQuote } from '@/lib/bookings/types';

export const bookingApi = {
  quote: (body: {
    propertyId: string;
    checkInDate: string;
    checkOutDate: string;
    guestCount: number;
    couponCode?: string;
  }) => apiClient.post<PriceQuote>('/api/bookings/quote', body),

  create: (body: {
    propertyId: string;
    checkInDate: string;
    checkOutDate: string;
    guestCount: number;
    couponCode?: string;
  }) => apiClient.post<{ booking: CustomerBooking; pricing: PriceQuote; idempotent?: boolean }>('/api/bookings', body),

  get: (id: string) => apiClient.get<CustomerBooking>(`/api/bookings/${id}`),

  mine: (page = 1) =>
    apiClient.get<Paginated<CustomerBooking>>(`/api/bookings/my${toQueryString({ page, limit: 50 })}`),

  cancel: (id: string, reason?: string) =>
    apiClient.post<{ booking: CustomerBooking }>(`/api/bookings/${id}/cancel`, { reason }),

  createOrder: (bookingId: string) => apiClient.post<PaymentOrder>('/api/payments/orders', { bookingId }),

  verify: (body: { providerOrderId: string; providerPaymentId: string; signature: string }) =>
    apiClient.post('/api/payments/verify', body),

  review: (propertyId: string, body: { bookingId: string; rating: number; comment?: string }) =>
    apiClient.post(`/api/properties/${propertyId}/reviews`, body),
};
