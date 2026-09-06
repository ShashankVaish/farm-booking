import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { RazorpayProvider } from './providers/razorpay.provider';

@Module({
  imports: [NotificationsModule, AvailabilityModule, PricingModule],
  controllers: [PaymentsController],
  providers: [
    RazorpayProvider,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: RazorpayProvider,
    },
    PaymentsService,
  ],
  exports: [PAYMENT_PROVIDER, PaymentsService],
})
export class PaymentsModule {}
