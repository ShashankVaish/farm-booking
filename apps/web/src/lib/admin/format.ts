export const ADMIN_PAYMENT_PUBLIC_FIELDS = [
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

const SENSITIVE_PAYMENT_PATTERN =
  /(cvv|cvc|pan|card|otp|signature|secret|password|authorization|api[_-]?key|keyId|keySecret|webhook|metadata|failureReason)/i;

export function formatInr(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDay(value: string | Date | null | undefined) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function statusLabel(value: string | null | undefined) {
  if (!value) return '—';
  return value.replaceAll('_', ' ');
}

export function occupancyPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function hasSensitivePaymentFields(view: object) {
  return Object.keys(view).some((key) => SENSITIVE_PAYMENT_PATTERN.test(key));
}

export function isPublicPaymentView(view: object) {
  const allowed = new Set<string>(ADMIN_PAYMENT_PUBLIC_FIELDS);
  return Object.keys(view).every((key) => allowed.has(key)) && !hasSensitivePaymentFields(view);
}

/**
 * Razorpay reports several distinct problems as the same opaque string, and the
 * most common one in practice is that the account balance is lower than the
 * refund. Refunds are paid out of the Razorpay balance rather than clawed back
 * from the original payment, so a large refund can fail on a funded-but-thin
 * account — and in test mode the dummy balance runs out quickly.
 */
export function refundFailureHint(gatewayStatus?: string | null): string | null {
  if (!gatewayStatus) return null;
  if (/balance/i.test(gatewayStatus)) {
    return 'Top up the Razorpay account balance, then retry the refund.';
  }
  if (/invalid request sent/i.test(gatewayStatus)) {
    return 'Usually means the Razorpay balance is below the refund amount. Refunds are paid from your Razorpay balance, not taken back from the original payment. Top up and retry.';
  }
  return null;
}
