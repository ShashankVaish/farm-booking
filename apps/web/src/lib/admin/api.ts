import { apiClient } from '@/lib/api/client';
import { toQueryString } from '@/lib/api/query';
import type { AuthUser } from '@/lib/properties/types';
import type {
  AdminAmenity,
  AdminBooking,
  AdminCoupon,
  AdminList,
  AdminNotification,
  AdminOverview,
  AdminPaymentView,
  AdminPayoutStatement,
  AdminProperty,
  AdminPropertyDetail,
  AdminRefund,
  AdminReports,
  AdminReview,
  AdminSettings,
  AdminTicket,
  AdminUser,
} from '@/lib/admin/types';

export type AdminListQuery = {
  page?: number;
  hours?: number;
  limit?: number;
  q?: string;
  status?: string;
  role?: string;
  registeredFrom?: string;
  registeredTo?: string;
  from?: string;
  to?: string;
};

function listPath(path: string, query: AdminListQuery = {}) {
  return `/api/admin/${path}${toQueryString(query)}`;
}

export const adminApi = {
  me: () => apiClient.get<AuthUser>('/api/auth/me'),
  overview: () => apiClient.get<AdminOverview>('/api/admin/overview'),
  reports: (query: AdminListQuery = {}) => apiClient.get<AdminReports>(listPath('reports', query)),
  settings: () => apiClient.get<AdminSettings>('/api/admin/settings'),
  updateSettings: (body: { platformFeeBps?: number; bookingExpireMinutes?: number }) =>
    apiClient.patch<AdminSettings>('/api/admin/settings', body),
  users: (query: AdminListQuery = {}) => apiClient.get<AdminList<AdminUser>>(listPath('users', query)),
  owners: (query: AdminListQuery = {}) => apiClient.get<AdminList<AdminUser>>(listPath('owners', query)),
  setUserActive: (id: string, isActive: boolean) =>
    apiClient.patch<AdminUser>(`/api/admin/users/${id}`, { isActive }),
  properties: (query: AdminListQuery = {}) =>
    apiClient.get<AdminList<AdminProperty>>(listPath('properties', query)),
  property: (id: string) => apiClient.get<AdminPropertyDetail>(`/api/admin/properties/${id}`),
  approveProperty: (id: string) => apiClient.post(`/api/admin/properties/${id}/approve`),
  rejectProperty: (id: string, reason: string) =>
    apiClient.post(`/api/admin/properties/${id}/reject`, { reason }),
  requestPropertyChanges: (id: string, reason: string) =>
    apiClient.post(`/api/admin/properties/${id}/request-changes`, { reason }),
  suspendProperty: (id: string, reason: string) =>
    apiClient.post(`/api/admin/properties/${id}/suspend`, { reason }),
  restoreProperty: (id: string) => apiClient.post(`/api/admin/properties/${id}/restore`),
  bookings: (query: AdminListQuery = {}) =>
    apiClient.get<AdminList<AdminBooking>>(listPath('bookings', query)),
  booking: (id: string) => apiClient.get<AdminBooking>(`/api/admin/bookings/${id}`),
  cancelBooking: (bookingId: string, reason: string, blockDates: boolean) =>
    apiClient.post<{
      booking: { id: string; status: string };
      refund: unknown;
      blockedDates: number;
    }>(`/api/admin/bookings/${bookingId}/cancel`, { reason, blockDates }),
  requestRefund: (bookingId: string, reason: string, amount?: number) =>
    apiClient.post(`/api/admin/bookings/${bookingId}/refund`, { reason, amount }),
  payments: (query: AdminListQuery & { hours?: number } = {}) =>
    apiClient.get<AdminList<AdminPaymentView>>(listPath('payments', query)),
  deletePayment: (id: string) =>
    apiClient.delete<{ deleted: boolean; id: string }>(`/api/admin/payments/${id}`),
  reconcilePayment: (id: string) =>
    apiClient.post<{ payment: AdminPaymentView | null; reconciled: boolean }>(
      `/api/admin/payments/${id}/reconcile`,
    ),
  expireAbandonedPayments: () => apiClient.post('/api/admin/payments/expire-abandoned'),
  payouts: (params: { date?: string; days?: number } = {}) =>
    apiClient.get<AdminPayoutStatement>(`/api/admin/payouts${toQueryString(params)}`),
  refunds: (query: AdminListQuery = {}) =>
    apiClient.get<AdminList<AdminRefund>>(listPath('refunds', query)),
  coupons: (query: AdminListQuery = {}) =>
    apiClient.get<AdminList<AdminCoupon>>(listPath('coupons', query)),
  createCoupon: (body: Record<string, unknown>) => apiClient.post<AdminCoupon>('/api/admin/coupons', body),
  updateCoupon: (id: string, body: Record<string, unknown>) =>
    apiClient.patch<AdminCoupon>(`/api/admin/coupons/${id}`, body),
  deleteCoupon: (id: string) => apiClient.delete(`/api/admin/coupons/${id}`),
  amenities: () => apiClient.get<AdminAmenity[]>('/api/amenities', { auth: false }),
  createAmenity: (body: { name: string; icon?: string }) =>
    apiClient.post<AdminAmenity>('/api/admin/amenities', body),
  updateAmenity: (id: string, body: { name?: string; icon?: string }) =>
    apiClient.patch<AdminAmenity>(`/api/admin/amenities/${id}`, body),
  deleteAmenity: (id: string) => apiClient.delete(`/api/admin/amenities/${id}`),
  reviews: (query: AdminListQuery = {}) =>
    apiClient.get<AdminList<AdminReview>>(listPath('reviews', query)),
  moderateReview: (id: string, isPublished: boolean) =>
    apiClient.patch<AdminReview>(`/api/admin/reviews/${id}`, { isPublished }),
  tickets: (query: AdminListQuery = {}) =>
    apiClient.get<AdminList<AdminTicket>>(listPath('support-tickets', query)),
  updateTicket: (id: string, status: string) =>
    apiClient.patch<AdminTicket>(`/api/admin/support-tickets/${id}`, { status }),
  notifications: (query: AdminListQuery = {}) =>
    apiClient.get<AdminList<AdminNotification>>(listPath('notifications', query)),
};
