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
  customerName: string;
  customerPhone?: string | null;
  description: string;
  receipt: string;
  /** Where the gateway sends the browser back after checkout. */
  returnUrl: string;
  /** Where the gateway posts server-to-server notifications. */
  webhookUrl: string;
  /** How long the gateway should keep the order payable. */
  expiresInSeconds?: number;
}

export interface CreatePaymentIntentResult {
  provider: string;
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  status: PaymentIntentStatus;
  /**
   * Anything the provider needs again later — a hosted checkout URL, for
   * instance. Stored on the payment row as-is and handed back to
   * `checkoutForm`, so the provider never has to re-fetch what it already knew.
   */
  metadata?: Record<string, string>;
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
  /** Whatever `createIntent` asked to have kept. */
  metadata?: Record<string, string> | null;
}

export interface CheckoutForm {
  action: string;
  /** GET is a plain redirect to `action`; POST submits `fields` to it. */
  method: 'GET' | 'POST';
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
  /** What the report is about. Absent means a payment. */
  kind?: 'payment' | 'refund';
  /**
   * True when the report carried a signature we checked. A browser redirect
   * from a gateway that does not sign redirects is `false` — which is fine,
   * because settlement re-fetches the payment from the gateway regardless.
   */
  verified: boolean;
  providerOrderId: string;
  providerPaymentId: string | null;
  status: PaymentIntentStatus;
  amountPaise: number | null;
  bookingId?: string;
  reason?: string;
  /** Set when `kind` is 'refund'. */
  refund?: {
    providerRefundId: string;
    /** The gateway's own word for the refund's state, lower-cased. */
    providerStatus: string;
  };
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
  /** The order the payment was made against; some gateways refund by order. */
  providerOrderId?: string | null;
  /** Our own id for this refund, used to derive the gateway's refund id. */
  reference?: string;
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
  parseNotification(
    rawBody: string,
    headers?: Record<string, string | undefined>,
  ): GatewayNotification | null;
  /**
   * The order id from the browser's return to the site, or null. The return
   * is never trusted for an outcome; the caller asks the gateway.
   */
  parseReturn(rawQuery: string): string | null;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  createRefund(input: CreateRefundInput): Promise<CreateRefundResult>;
  fetchRefund(
    providerRefundId: string,
  ): Promise<{ providerStatus: string; amountPaise: number | null } | null>;
  fetchOrder(providerOrderId: string): Promise<FetchOrderResult | null>;
  fetchPayment(
    providerPaymentId: string,
    providerOrderId?: string,
  ): Promise<FetchPaymentResult | null>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
