import { Injectable } from '@nestjs/common';
import {
  CreatePaymentIntentResult,
  PaymentProvider,
  VerifyPaymentResult,
} from './payment-provider.interface';

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'RAZORPAY';

  createIntent(): Promise<CreatePaymentIntentResult> {
    return Promise.reject(
      new Error('Razorpay checkout is not implemented in Phase 1.'),
    );
  }

  verifyPayment(): Promise<VerifyPaymentResult> {
    return Promise.reject(
      new Error('Razorpay verification is not implemented in Phase 1.'),
    );
  }
}
