import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  calculatePriceBreakdown,
  type CouponDiscountInput,
  type PriceBreakdown,
  type PropertyPricingInput,
} from './pricing.util';

@Injectable()
export class PricingService {
  constructor(private readonly config: ConfigService) {}

  quote(params: {
    property: PropertyPricingInput;
    checkIn: Date | string;
    checkOut: Date | string;
    guestCount: number;
    coupon?: CouponDiscountInput | null;
  }): PriceBreakdown {
    return calculatePriceBreakdown({
      ...params,
      platformFeeBps: this.config.get<number>('PLATFORM_FEE_BPS', 500),
    });
  }

  platformFeeBps(): number {
    return this.config.get<number>('PLATFORM_FEE_BPS', 500);
  }
}
