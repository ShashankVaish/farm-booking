import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { RazorpayProvider } from './providers/razorpay.provider';

@Module({
  providers: [
    RazorpayProvider,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: RazorpayProvider,
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
