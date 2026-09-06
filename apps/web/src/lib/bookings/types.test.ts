import { describe, expect, it } from 'vitest';
import { openBookingKey, paymentStatusLabel } from '@/lib/bookings/types';

describe('booking helpers', () => {
  it('uses a stable key so reserve clicks resume the same booking', () => {
    expect(openBookingKey('p1', '2026-10-01', '2026-10-03', 4)).toBe(
      'open-booking:p1:2026-10-01:2026-10-03:4',
    );
  });

  it('labels payment state from booking status', () => {
    expect(
      paymentStatusLabel({
        id: 'b1',
        status: 'CONFIRMED',
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-03',
        guestCount: 2,
        baseAmount: '1',
        weekendAmount: '0',
        extraGuestAmount: '0',
        platformFee: '0',
        discountAmount: '0',
        totalAmount: '1',
        property: { id: 'p1', title: 'Stay' },
      }),
    ).toBe('Paid');
  });
});
