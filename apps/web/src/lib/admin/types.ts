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

export type AdminPropertyDetail = {
  id: string;
  status: string;
  title: string;
  slug: string;
  description: string;
  propertyType: string;
  isPartyFriendly: boolean;
  /** The admin-awarded trust badge. Set only through the two admin routes. */
  isTrusted: boolean;
  trustedAt: string | null;
  createdAt: string;
  updatedAt: string;
  location: {
    location: string;
    address: string;
    city: string;
    state: string;
    country: string;
    pincode: string | null;
    latitude: number;
    longitude: number;
  };
  capacity: { guests: number; bedrooms: number; bathrooms: number };
  pricing: {
    basePrice: string;
    weekendPrice: string | null;
    extraGuestCharge: string | null;
  };
  rules: {
    propertyRules: string | null;
    partyRules: string | null;
    cancellationPolicy: string | null;
  };
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
    isCover: boolean;
    sortOrder: number;
  }>;
  amenities: Array<{ id: string; name: string; slug: string }>;
  documents: Array<{
    id: string;
    name: string;
    documentType: string;
    url: string;
    status: string;
    createdAt: string;
  }>;
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    phoneVerified: boolean;
    isActive: boolean;
    memberSince: string;
    otherListings: number;
    profile: {
      businessName: string | null;
      gstNumber: string | null;
      panNumber: string | null;
      panImageUrl: string | null;
      aadhaarLast4: string | null;
      aadhaarImageUrl: string | null;
      kycStatus: 'NOT_SUBMITTED' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
      kycSubmittedAt: string | null;
      kycRejectionReason: string | null;
      kycVerified: boolean;
    } | null;
  };
  stats: { bookings: number; reviews: number; averageRating: number };
  auditTrail: Array<{
    id: string;
    action: string;
    metadata: { reason?: string } | null;
    createdAt: string;
    actor?: { id: string; name: string; email: string } | null;
  }>;
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
    /** What the gateway reported — the only clue when a refund fails. */
    gatewayStatus: string | null;
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
  gatewayStatus: string | null;
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
  paymentMode: 'test' | 'live';
  paymentConfigured: boolean;
  smsProvider: string;
  smsConfigured: boolean;
  mailProvider: string;
  /** False when the API fell back to logging emails instead of sending them. */
  mailConfigured: boolean;
  mailFrom: string | null;
  environment?: string;
};

export type AdminList<T> = Paginated<T>;

export type PayoutStay = {
  bookingId: string;
  property: string;
  city: string;
  guest: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** True once the guest has checked out, i.e. the money is earned. */
  settled: boolean;
  gross: string;
  platformFee: string;
  refunded: string;
  net: string;
};

export type PayoutHost = {
  owner: { id: string; name: string; email: string; phone: string | null; phoneVerified: boolean };
  bank: {
    accountHolderName: string | null;
    /** Masked to the last four digits. */
    accountMasked: string | null;
    ifsc: string | null;
    bankName: string | null;
    onFile: boolean;
  };
  kycStatus: 'NOT_SUBMITTED' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  panNumber: string | null;
  stays: PayoutStay[];
  stayCount: number;
  gross: string;
  platformFee: string;
  refunded: string;
  /** Earned and due now. */
  payableNow: string;
  payableNowStays: number;
  /** Paid by the guest, but the stay has not happened yet. */
  upcoming: string;
  upcomingStays: number;
  netPayable: string;
  payable: boolean;
  blockedReason: string | null;
  currency: string;
};

export type AdminPayoutStatement = {
  /** Null when the statement covers everything owed rather than a window. */
  from: string | null;
  to: string | null;
  days: number | null;
  windowed: boolean;
  asOf: string;
  currency: string;
  totals: {
    hosts: number;
    stays: number;
    gross: string;
    platformFee: string;
    refunded: string;
    netPayable: string;
    payableNow: string;
    upcoming: string;
    readyToPay: string;
    onHold: string;
  };
  hosts: PayoutHost[];
};
