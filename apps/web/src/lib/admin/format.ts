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
 * Turns the gateway's refund rejection into something an admin can act on.
 *
 * Every gateway pays refunds out of the merchant balance rather than clawing
 * the money back from the original charge, so the common failure on a young
 * account is simply that the balance is lower than the refund. PayU says so in
 * plain words; a couple of its other phrasings are mapped here too.
 */
export function refundFailureHint(gatewayStatus?: string | null): string | null {
  if (!gatewayStatus) return null;
  if (/balance|insufficient/i.test(gatewayStatus)) {
    return 'Top up the PayU merchant balance, then retry the refund. Refunds are paid from the balance, not taken back from the original payment.';
  }
  if (/already|duplicate/i.test(gatewayStatus)) {
    return 'PayU already has a refund request for this payment. Check its status in the PayU dashboard before retrying.';
  }
  if (/not (found|captured)|invalid/i.test(gatewayStatus)) {
    return 'PayU could not match this payment. Confirm the payment shows as captured in the PayU dashboard.';
  }
  return null;
}
