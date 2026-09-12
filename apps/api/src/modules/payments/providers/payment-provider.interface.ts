export type PaymentIntentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED';

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

/**
 * Everything a hosted-checkout gateway needs to render its payment page for
 * one attempt. The browser POSTs `fields` to `action` and leaves the site;
 * the gateway sends it back to the return URL afterwards.
 */
export interface CheckoutFormInput {
  providerOrderId: string;
  bookingId: string;
  amountPaise: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  /** Where the gateway sends the browser back, for both outcomes. */
  returnUrl: string;
}

export interface CheckoutForm {
  action: string;
  fields: Record<string, string>;
}

/**
 * A gateway's report of an attempt's outcome, whether it arrived as the
 * browser being sent back to the return URL or as a server-to-server webhook.
 * `verified` means the report's own integrity check passed; it is never on its
 * own enough to settle — the service still re-fetches the payment from the
 * gateway before touching a booking.
 */
export interface GatewayNotification {
  verified: boolean;
  providerOrderId: string;
  providerPaymentId: string | null;
  status: PaymentIntentStatus;
  amountPaise: number | null;
  bookingId?: string;
  reason?: string;
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

export interface CreateRefundInput {
  providerPaymentId: string;
  amountPaise: number;
  notes?: string;
  /** 'optimum' asks the gateway for the fastest settlement it can offer. */
  speed?: 'normal' | 'optimum';
}

export interface CreateRefundResult {
  providerRefundId: string | null;
  providerStatus: string;
}

export interface FetchOrderResult {
  providerOrderId: string;
  status: PaymentIntentStatus;
  providerPaymentId?: string;
  amountPaise?: number;
}

export interface FetchPaymentResult {
  providerPaymentId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  captured: boolean;
  status: PaymentIntentStatus;
  bookingId?: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** True once the credentials the gateway needs are all present. */
  isConfigured(): boolean;
  createIntent(
    input: CreatePaymentIntentInput,
  ): Promise<CreatePaymentIntentResult>;
  checkoutForm(input: CheckoutFormInput): CheckoutForm;
  /**
   * Parses and integrity-checks a report the gateway posted to us. Returns
   * null when the body is not something this gateway would send.
   */
  parseNotification(rawBody: string): GatewayNotification | null;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  createRefund(input: CreateRefundInput): Promise<CreateRefundResult>;
  fetchOrder(providerOrderId: string): Promise<FetchOrderResult | null>;
  fetchPayment(providerPaymentId: string): Promise<FetchPaymentResult | null>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
