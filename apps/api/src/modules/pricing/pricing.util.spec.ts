import { calculatePriceBreakdown, computeDiscount } from './pricing.util';
import { Prisma } from '@prisma/client';

describe('pricing', () => {
  const property = {
    basePrice: '1000.00',
    weekendPrice: '1500.00',
    extraGuestCharge: '200.00',
    guestCapacity: 10,
  };

  it('calculates weekday, weekend, extra guest, platform fee, and discount', () => {
    const breakdown = calculatePriceBreakdown({
      property,
      checkIn: '2026-09-10',
      checkOut: '2026-09-14',
      guestCount: 4,
      platformFeeBps: 500,
      coupon: {
        discountType: 'PERCENTAGE',
        discountValue: '10',
        maxDiscount: '1000',
      },
    });

    // Thu 10, Fri 11, Sat 12, Sun 13 => 2 weekday, 2 weekend
    expect(breakdown.nights).toBe(4);
    expect(breakdown.weekdayNights).toBe(2);
    expect(breakdown.weekendNights).toBe(2);
    expect(breakdown.extraGuests).toBe(2);
    expect(breakdown.baseAmount).toBe('2000.00');
    expect(breakdown.weekendAmount).toBe('3000.00');
    expect(breakdown.extraGuestAmount).toBe('1600.00');
    expect(breakdown.platformFee).toBe('330.00');
    expect(breakdown.discountAmount).toBe('660.00');
    expect(breakdown.totalAmount).toBe('6270.00');
  });

  it('never lets a coupon exceed the subtotal', () => {
    const discount = computeDiscount(new Prisma.Decimal('500.00'), {
      discountType: 'FIXED',
      discountValue: '900.00',
    });
    expect(discount.toFixed(2)).toBe('500.00');
  });

  it('caps percentage discounts at maxDiscount', () => {
    const discount = computeDiscount(new Prisma.Decimal('10000.00'), {
      discountType: 'PERCENTAGE',
      discountValue: '50',
      maxDiscount: '100.00',
    });
    expect(discount.toFixed(2)).toBe('100.00');
  });
});
