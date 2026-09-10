import { describe, expect, it } from 'vitest';
import { formatDay, formatInr, hasSensitivePaymentFields, isPublicPaymentView, occupancyPercent, refundFailureHint, statusLabel } from '@/lib/admin/format';

describe('admin format helpers', () => {
  it('formats money and occupancy', () => {
    expect(formatInr('12500.50')).toContain('12,500.50');
    expect(occupancyPercent(0.423)).toBe('42%');
    expect(statusLabel('PENDING_APPROVAL')).toBe('PENDING APPROVAL');
    expect(formatDay('2026-09-07T12:00:00.000Z')).toBe('2026-09-07');
  });

  it('rejects sensitive payment fields from admin views', () => {
    const safe = {
      id: 'pay_1',
      bookingId: 'b1',
      provider: 'RAZORPAY',
      gatewayPaymentId: 'pay_gateway',
      gatewayOrderId: 'order_gateway',
      amount: '1000.00',
      currency: 'INR',
      status: 'SUCCESS',
      verifiedAt: null,
      expiresAt: null,
      createdAt: '2026-09-07T00:00:00.000Z',
    };
    expect(isPublicPaymentView(safe)).toBe(true);
    expect(
      hasSensitivePaymentFields({
        ...safe,
        signature: 'sig',
        metadata: { card: '4111' },
      }),
    ).toBe(true);
    expect(isPublicPaymentView({ ...safe, failureReason: 'card declined' })).toBe(false);
  });
});

describe('refundFailureHint', () => {
  it('explains the opaque gateway error that really means low balance', () => {
    const hint = refundFailureHint('invalid request sent');
    expect(hint).toContain('balance');
    expect(hint).toContain('retry');
  });

  it('handles an explicit balance error', () => {
    expect(refundFailureHint('Your account does not have enough balance')).toContain(
      'Top up',
    );
  });

  it('stays quiet when there is nothing useful to add', () => {
    expect(refundFailureHint(null)).toBeNull();
    expect(refundFailureHint(undefined)).toBeNull();
    expect(refundFailureHint('processed')).toBeNull();
  });
});
