import { ApiError, NetworkError } from '@/lib/api/errors';

/**
 * Turns a checkout failure into something a guest can act on.
 *
 * In development the API echoes raw exception text on a 500 — a guest should
 * never read a Prisma stack trace mid-payment. Anything server-side becomes a
 * calm message that also reassures them the booking still exists, because the
 * booking is created before payment and survives a failed attempt.
 */
export function payErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof NetworkError) {
    return 'We could not reach the payment service. Check your connection and try again.';
  }

  if (error instanceof ApiError) {
    // Check the specific code first: the gateway error arrives as a 503, so a
    // status-only test would swallow it into the generic server message.
    if (error.code === 'PAYMENT_PROVIDER_ERROR') {
      return 'The payment gateway is not responding. Your booking is saved — try again shortly.';
    }
    if (error.status >= 500 || error.code === 'INTERNAL_ERROR') {
      return 'Payment could not be started because of a problem on our side. Your booking is saved — please try again in a moment.';
    }
    // 4xx messages are written for guests already (expired booking, dates
    // taken, amount mismatch), so they pass through unchanged.
    return error.message;
  }

  return fallback;
}
