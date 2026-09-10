import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { CouponsModule } from '../coupons/coupons.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [
    NotificationsModule,
    CouponsModule,
    PaymentsModule,
    ReviewsModule,
    PricingModule,
    BookingsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, PayoutsService],
})
export class AdminModule {}
