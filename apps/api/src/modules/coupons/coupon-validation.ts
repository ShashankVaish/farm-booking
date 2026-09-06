import { Coupon, DiscountType } from '@prisma/client';
import { money } from '../../common/money';
import { ErrorCodes } from '../../common/constants/error-codes';

export class CouponValidationError extends Error {
  constructor(
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
  }
}

export function validateCouponRules(
  coupon: Pick<
    Coupon,
    | 'isActive'
    | 'startsAt'
    | 'endsAt'
    | 'minBookingAmount'
    | 'maxRedemptions'
    | 'redemptionCount'
    | 'maxRedemptionsPerUser'
  >,
  subtotal: string | number,
  now = new Date(),
  userRedemptionCount = 0,
): void {
  if (!coupon.isActive) {
    throw new CouponValidationError(
      ErrorCodes.COUPON_INVALID,
      'This coupon is not active.',
    );
  }

  if (now < coupon.startsAt || now > coupon.endsAt) {
    throw new CouponValidationError(
      ErrorCodes.COUPON_EXPIRED,
      'This coupon is outside its valid date range.',
    );
  }

  if (
    coupon.maxRedemptions !== null &&
    coupon.redemptionCount >= coupon.maxRedemptions
  ) {
    throw new CouponValidationError(
      ErrorCodes.COUPON_LIMIT_REACHED,
      'This coupon has reached its redemption limit.',
    );
  }

  if (
    coupon.maxRedemptionsPerUser !== null &&
    userRedemptionCount >= coupon.maxRedemptionsPerUser
  ) {
    throw new CouponValidationError(
      ErrorCodes.COUPON_LIMIT_REACHED,
      'You have already used this coupon the maximum number of times.',
    );
  }

  if (
    coupon.minBookingAmount &&
    money(subtotal).lessThan(money(coupon.minBookingAmount))
  ) {
    throw new CouponValidationError(
      ErrorCodes.COUPON_MIN_AMOUNT,
      'This booking does not meet the coupon minimum amount.',
    );
  }
}

export function isPercentageCoupon(type: DiscountType): boolean {
  return type === 'PERCENTAGE';
}
