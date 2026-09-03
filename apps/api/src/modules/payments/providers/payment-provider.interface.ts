export type PaymentIntentStatus =
  'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface CreatePaymentIntentInput {
  bookingId: string;
  amountPaise: number;
  currency: string;
  customerEmail: string;
  receipt: string;
}

export interface CreatePaymentIntentResult {
  provider: string;
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  status: PaymentIntentStatus;
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  status: PaymentIntentStatus;
  providerPaymentId: string;
}

export interface PaymentProvider {
  readonly name: string;
  createIntent(
    input: CreatePaymentIntentInput,
  ): Promise<CreatePaymentIntentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
