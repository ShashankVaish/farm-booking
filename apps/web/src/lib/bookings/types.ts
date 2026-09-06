export type PriceQuote = {
  nights: number;
  weekdayNights?: number;
  weekendNights?: number;
  extraGuests?: number;
  baseAmount: string;
  weekendAmount: string;
  extraGuestAmount: string;
  platformFee: string;
  discountAmount: string;
  totalAmount: string;
  currency?: string;
};

export type BookingPayment = {
  id: string;
  status: string;
  provider?: string;
  amount?: string | number;
  failureReason?: string | null;
};

export type CustomerBooking = {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  baseAmount: string | number;
  weekendAmount: string | number;
  extraGuestAmount: string | number;
  platformFee: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  currency?: string;
  cancellationPolicy?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  coupon?: { code: string } | null;
  review?: { id: string; rating?: number } | null;
  payments?: BookingPayment[];
  property: {
    id: string;
    title: string;
    city?: string;
    state?: string;
    location?: string;
    address?: string;
    cancellationPolicy?: string | null;
    guestCapacity?: number;
    images?: Array<{ url: string; altText?: string | null }>;
  };
};

export type PaymentOrder = {
  paymentId: string;
  provider: string;
  providerOrderId: string;
  amount: string | number;
  currency: string;
  keyId: string | null;
};

export function openBookingKey(propertyId: string, checkIn: string, checkOut: string, guests: number): string {
  return `open-booking:${propertyId}:${checkIn}:${checkOut}:${guests}`;
}

export function paymentStatusLabel(booking: CustomerBooking): string {
  if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') return 'Paid';
  if (booking.status === 'CANCELLED') return 'Cancelled';
  if (booking.status === 'EXPIRED') return 'Expired';
  const latest = booking.payments?.[0]?.status;
  if (latest === 'FAILED') return 'Payment failed';
  if (booking.status === 'PAYMENT_PENDING') return 'Payment pending';
  return 'Awaiting payment';
}

export function isUpcoming(booking: CustomerBooking, today = new Date().toISOString().slice(0, 10)): boolean {
  return ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED'].includes(booking.status) && booking.checkOutDate.slice(0, 10) >= today;
}

export function isPastTrip(booking: CustomerBooking, today = new Date().toISOString().slice(0, 10)): boolean {
  return booking.status === 'COMPLETED' || (booking.status === 'CONFIRMED' && booking.checkOutDate.slice(0, 10) < today);
}
