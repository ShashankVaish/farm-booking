import { money } from '../../common/money';

const PAYMENT_PUBLIC_FIELDS = [
  'id',
  'bookingId',
  'provider',
  'gatewayPaymentId',
  'gatewayOrderId',
  'amount',
  'currency',
  'status',
  'verifiedAt',
  'expiresAt',
  'createdAt',
  'booking',
] as const;

export type AdminPaymentView = {
  id: string;
  bookingId: string;
  provider: string;
  gatewayPaymentId: string | null;
  gatewayOrderId: string | null;
  amount: string;
  currency: string;
  status: string;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  booking?: { id: string; status: string };
};

export function presentAdminPayment(payment: {
  id: string;
  bookingId: string;
  provider: string;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  amount: unknown;
  currency: string;
  status: string;
  verifiedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
  metadata?: unknown;
  failureReason?: string | null;
  booking?: { id: string; status: string };
}): AdminPaymentView {
  const view: AdminPaymentView = {
    id: payment.id,
    bookingId: payment.bookingId,
    provider: payment.provider,
    gatewayPaymentId: payment.providerPaymentId ?? null,
    gatewayOrderId: payment.providerOrderId ?? null,
    amount: money(String(payment.amount)).toFixed(2),
    currency: payment.currency,
    status: payment.status,
    verifiedAt: payment.verifiedAt ?? null,
    expiresAt: payment.expiresAt ?? null,
    createdAt: payment.createdAt,
  };
  if (payment.booking) {
    view.booking = payment.booking;
  }
  return view;
}

export function assertNoSensitivePaymentFields(view: object): void {
  const keys = Object.keys(view);
  for (const key of keys) {
    if (
      !PAYMENT_PUBLIC_FIELDS.includes(
        key as (typeof PAYMENT_PUBLIC_FIELDS)[number],
      )
    ) {
      throw new Error(`Unexpected payment field: ${key}`);
    }
  }
}
