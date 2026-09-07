import type { Paginated } from '@/lib/properties/types';

export type AdminOverview = {
  totalBookings: number;
  todaysBookings: number;
  revenue: string;
  platformCommission: string;
  pendingPayments: number;
  refunds: number;
  users: number;
  owners: number;
  properties: number;
  occupancy: number;
  recentActivity: AdminAuditEvent[];
};

export type AdminAuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actor?: { id: string; name: string; email: string } | null;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'OWNER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
};

export type AdminProperty = {
  id: string;
  title: string;
  city: string;
  state: string;
  status: string;
  createdAt: string;
  owner?: { id: string; name: string; email: string };
};

export type AdminPaymentView = {
  id: string;
  bookingId: string;
  provider: string;
  gatewayPaymentId: string | null;
  gatewayOrderId: string | null;
  amount: string;
  currency: string;
  status: string;
  verifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  booking?: { id: string; status: string };
};

export type AdminBooking = {
  id: string;
  customer: { id: string; name: string; email: string };
  owner: { id: string; name: string; email: string };
  property: { id: string; title: string; city?: string; state?: string };
  dates: { checkIn: string; checkOut: string };
  guestCount: number;
  amount: {
    base: string;
    weekend: string;
    extraGuest: string;
    platformFee: string;
    discount: string;
    total: string;
    currency: string;
  };
  payment: AdminPaymentView | null;
  payments: AdminPaymentView[];
  status: string;
  cancellation: { cancelledAt: string } | null;
  refunds: Array<{
    id: string;
    paymentId?: string;
    amount: string;
    status: string;
    reason: string | null;
    gatewayRefundId: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  completedAt: string | null;
};

export type AdminRefund = {
  id: string;
  bookingId: string;
  paymentId: string;
  amount: string;
  reason: string | null;
  status: string;
  gatewayRefundId: string | null;
  createdAt: string;
  booking?: { id: string; status: string; totalAmount: string | number };
  payment?: {
    id: string;
    status: string;
    amount: string;
    gatewayPaymentId: string | null;
    gatewayOrderId: string | null;
  };
};

export type AdminCoupon = {
  id: string;
  code: string;
  description?: string | null;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: string | number;
  maxDiscount?: string | number | null;
  minBookingAmount?: string | number | null;
  startsAt: string;
  endsAt: string;
  maxRedemptions?: number | null;
  maxRedemptionsPerUser?: number | null;
  redemptionCount: number;
  isActive: boolean;
};

export type AdminAmenity = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
};

export type AdminReview = {
  id: string;
  rating: number;
  comment?: string | null;
  isPublished: boolean;
  createdAt: string;
  customer?: { id: string; name: string };
  property?: { id: string; title: string };
};

export type AdminTicket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  createdAt: string;
  user?: { id: string; name: string; email: string };
};

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string };
};

export type AdminReports = {
  from: string;
  to: string;
  bookings: Array<{ status: string; count: number }>;
  confirmedBookings: number;
  revenue: string;
  platformCommission: string;
  completedRefunds: number;
  refundedAmount: string;
  newUsers: number;
  newProperties: number;
};

export type AdminSettings = {
  platformFeeBps: number;
  platformFeePercent: number;
  bookingExpireMinutes: number;
  paymentProvider: string;
  razorpayConfigured: boolean;
  environment?: string;
};

export type AdminList<T> = Paginated<T>;
