import { Prisma } from '@prisma/client';
import { enumerateNights, isWeekendUtc } from '../../common/dates';
import {
  addMoney,
  money,
  multiplyMoney,
  subtractMoney,
} from '../../common/money';

export const INCLUDED_GUESTS = 2;

export interface PropertyPricingInput {
  basePrice: Prisma.Decimal | number | string;
  weekendPrice?: Prisma.Decimal | number | string | null;
  extraGuestCharge?: Prisma.Decimal | number | string | null;
  guestCapacity: number;
}

export interface CouponDiscountInput {
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: Prisma.Decimal | number | string;
  maxDiscount?: Prisma.Decimal | number | string | null;
}

export interface PriceBreakdown {
  nights: number;
  weekdayNights: number;
  weekendNights: number;
  extraGuests: number;
  baseAmount: string;
  weekendAmount: string;
  extraGuestAmount: string;
  platformFee: string;
  discountAmount: string;
  totalAmount: string;
  currency: string;
}

export function calculatePriceBreakdown(params: {
  property: PropertyPricingInput;
  checkIn: Date | string;
  checkOut: Date | string;
  guestCount: number;
  platformFeeBps: number;
  coupon?: CouponDiscountInput | null;
}): PriceBreakdown {
  const nights = enumerateNights(params.checkIn, params.checkOut);
  if (nights.length === 0) {
    throw new Error('A booking must include at least one night.');
  }

  const weekendNights = nights.filter((night) => isWeekendUtc(night)).length;
  const weekdayNights = nights.length - weekendNights;
  const extraGuests = Math.max(0, params.guestCount - INCLUDED_GUESTS);

  const basePrice = money(params.property.basePrice);
  const weekendNightPrice = params.property.weekendPrice
    ? money(params.property.weekendPrice)
    : basePrice;
  const extraGuestCharge = params.property.extraGuestCharge
    ? money(params.property.extraGuestCharge)
    : money(0);

  const baseAmount = multiplyMoney(basePrice, weekdayNights);
  const weekendAmount = multiplyMoney(weekendNightPrice, weekendNights);
  const extraGuestAmount = multiplyMoney(
    extraGuestCharge,
    extraGuests * nights.length,
  );
  const subtotal = addMoney(baseAmount, weekendAmount, extraGuestAmount);
  const platformFee = money(subtotal.mul(params.platformFeeBps).div(10000));
  const discountAmount = computeDiscount(subtotal, params.coupon);
  const totalAmount = money(
    Prisma.Decimal.max(
      new Prisma.Decimal(0),
      subtractMoney(addMoney(subtotal, platformFee), discountAmount),
    ),
  );

  return {
    nights: nights.length,
    weekdayNights,
    weekendNights,
    extraGuests,
    baseAmount: baseAmount.toFixed(2),
    weekendAmount: weekendAmount.toFixed(2),
    extraGuestAmount: extraGuestAmount.toFixed(2),
    platformFee: platformFee.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    currency: 'INR',
  };
}

export function computeDiscount(
  subtotal: Prisma.Decimal,
  coupon?: CouponDiscountInput | null,
): Prisma.Decimal {
  if (!coupon) {
    return money(0);
  }

  let discount = money(0);
  if (coupon.discountType === 'PERCENTAGE') {
    discount = money(subtotal.mul(money(coupon.discountValue)).div(100));
    if (coupon.maxDiscount) {
      discount = money(Prisma.Decimal.min(discount, money(coupon.maxDiscount)));
    }
  } else {
    discount = money(coupon.discountValue);
  }

  return money(Prisma.Decimal.min(discount, subtotal));
}
