import { Module } from '@nestjs/common';
import { CouponsModule } from '../coupons/coupons.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    NotificationsModule,
    CouponsModule,
    PaymentsModule,
    ReviewsModule,
    PricingModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
