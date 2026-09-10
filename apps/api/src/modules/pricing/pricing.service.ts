import { Injectable } from '@nestjs/common';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import {
  calculatePriceBreakdown,
  type CouponDiscountInput,
  type PriceBreakdown,
  type PropertyPricingInput,
} from './pricing.util';

@Injectable()
export class PricingService {
  constructor(private readonly settings: PlatformSettingsService) {}

  quote(params: {
    property: PropertyPricingInput;
    checkIn: Date | string;
    checkOut: Date | string;
    guestCount: number;
    coupon?: CouponDiscountInput | null;
  }): PriceBreakdown {
    return calculatePriceBreakdown({
      ...params,
      platformFeeBps: this.platformFeeBps(),
    });
  }

  platformFeeBps(): number {
    return this.settings.getNumber('PLATFORM_FEE_BPS');
  }
}
