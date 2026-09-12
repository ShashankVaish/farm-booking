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

/**
 * A hosted-checkout gateway hands back a form for the browser to POST: the
 * guest leaves the site, pays on the gateway's page, and is sent back to the
 * booking. `checkout` is null when no gateway is configured on the server.
 */
export type CheckoutForm = {
  action: string;
  fields: Record<string, string>;
};

export type PaymentOrder = {
  paymentId: string;
  provider: string;
  providerOrderId: string;
  amount: string | number;
  currency: string;
  checkout: CheckoutForm | null;
};

/** What the gateway return URL appends when it sends the guest back. */
export type PaymentOutcome = 'failed' | 'cancelled' | 'pending' | 'unverified' | 'unknown';

export const PAYMENT_OUTCOME_MESSAGE: Record<PaymentOutcome, string> = {
  failed: 'The payment was declined. You can try again without creating a new booking.',
  cancelled: 'The payment was cancelled before it completed. Your dates are still held.',
  pending:
    'The gateway has your payment but we could not confirm it yet. This page will update on its own; if it does not, contact support with your booking ID.',
  unverified:
    'We received a response we could not verify. If you were charged, contact support with your booking ID and nothing will be lost.',
  unknown: 'We could not match that payment to a booking. Check your trips, or contact support.',
};

export function openBookingKey(propertyId: string, checkIn: string, checkOut: string, guests: number): string {
  return `open-booking:${propertyId}:${checkIn}:${checkOut}:${guests}`;
}

export function paymentStatusLabel(booking: CustomerBooking): string {
  if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') return 'Paid';
  if (booking.status === 'CANCELLED') return 'Cancelled';
  if (booking.status === 'EXPIRED') return 'Expired';
  if (booking.status === 'REFUNDED') return 'Refunded';
  const latest = booking.payments?.[0]?.status;
  if (latest === 'FAILED') return 'Payment failed';
  if (latest === 'REFUND_PENDING' || latest === 'REFUND_FAILED') return 'Refund in progress';
  if (booking.status === 'PAYMENT_PENDING') return 'Payment pending';
  return 'Awaiting payment';
}

export function isUpcoming(booking: CustomerBooking, today = new Date().toISOString().slice(0, 10)): boolean {
  return ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED'].includes(booking.status) && booking.checkOutDate.slice(0, 10) >= today;
}

export function isPastTrip(booking: CustomerBooking, today = new Date().toISOString().slice(0, 10)): boolean {
  return booking.status === 'COMPLETED' || (booking.status === 'CONFIRMED' && booking.checkOutDate.slice(0, 10) < today);
}
