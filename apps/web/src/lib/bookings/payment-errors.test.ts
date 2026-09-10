import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { payErrorMessage } from '@/lib/bookings/payment-errors';

describe('payErrorMessage', () => {
  it('never shows raw server exception text on a 500', () => {
    const leaked = new ApiError(
      500,
      'INTERNAL_ERROR',
      'Invalid `prisma.$queryRaw()` invocation: operator does not exist: text = uuid',
    );
    const message = payErrorMessage(leaked, 'fallback');
    expect(message).not.toContain('prisma');
    expect(message).not.toContain('uuid');
    expect(message).toContain('Your booking is saved');
  });

  it('explains a gateway outage without blaming the guest', () => {
    const message = payErrorMessage(
      new ApiError(503, 'PAYMENT_PROVIDER_ERROR', 'Unable to create a payment order.'),
      'fallback',
    );
    expect(message).toContain('payment gateway is not responding');
    expect(message).toContain('Your booking is saved');
  });

  it('passes through guest-facing 4xx messages unchanged', () => {
    const expired = new ApiError(
      400,
      'INVALID_STATUS_TRANSITION',
      'This booking expired. Start a new reservation.',
    );
    expect(payErrorMessage(expired, 'fallback')).toBe(
      'This booking expired. Start a new reservation.',
    );
  });

  it('handles a dropped connection', () => {
    expect(payErrorMessage(new NetworkError(), 'fallback')).toContain(
      'could not reach the payment service',
    );
  });

  it('falls back for anything unrecognised', () => {
    expect(payErrorMessage(new Error('boom'), 'Could not start payment.')).toBe(
      'Could not start payment.',
    );
    expect(payErrorMessage(undefined, 'Could not start payment.')).toBe(
      'Could not start payment.',
    );
  });
});
