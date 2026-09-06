import { validateCouponRules } from './coupon-validation';

describe('coupon validation', () => {
  const base = {
    isActive: true,
    startsAt: new Date('2026-01-01'),
    endsAt: new Date('2026-12-31'),
    minBookingAmount: '1000.00',
    maxRedemptions: 10,
    redemptionCount: 2,
    maxRedemptionsPerUser: null,
  };

  it('accepts a valid coupon', () => {
    expect(() =>
      validateCouponRules(base, '1500', new Date('2026-06-01')),
    ).not.toThrow();
  });

  it('rejects inactive, expired, min-amount, and exhausted coupons', () => {
    expect(() =>
      validateCouponRules(
        { ...base, isActive: false },
        '1500',
        new Date('2026-06-01'),
      ),
    ).toThrow();

    expect(() =>
      validateCouponRules(base, '1500', new Date('2027-01-02')),
    ).toThrow();

    expect(() =>
      validateCouponRules(base, '100', new Date('2026-06-01')),
    ).toThrow();

    expect(() =>
      validateCouponRules(
        { ...base, redemptionCount: 10 },
        '1500',
        new Date('2026-06-01'),
      ),
    ).toThrow();

    expect(() =>
      validateCouponRules(
        { ...base, maxRedemptionsPerUser: 1 },
        '1500',
        new Date('2026-06-01'),
        1,
      ),
    ).toThrow();
  });
});
