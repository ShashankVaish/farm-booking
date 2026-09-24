import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { ErrorCodes } from '../../../common/constants/error-codes';
import {
  CheckoutForm,
  CheckoutFormInput,
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  CreateRefundInput,
  CreateRefundResult,
  FetchOrderResult,
  FetchPaymentResult,
  GatewayNotification,
  PaymentIntentStatus,
  PaymentProvider,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from './payment-provider.interface';

const PROVIDER_TIMEOUT_MS = 15_000;

/*
  PhonePe Payment Gateway, Standard Checkout v2.

  The shape of this gateway, and what follows from it:

  1. Every call carries an OAuth token (`Authorization: O-Bearer …`) fetched
     with the client id, client version and client secret. The token lives
     about an hour; it is cached here and refreshed a minute early, and a 401
     on any call drops it and retries once with a fresh one.

  2. A payment is an *order* keyed by our own `merchantOrderId`. PhonePe
     answers with a hosted page URL and the guest is redirected there, so the
     checkout "form" is a GET to that URL, kept on the payment row. Our
     `merchantOrderId` is the payment row's `providerOrderId`, because every
     later call (status, refund) is addressed by it.

  3. After checkout PhonePe sends the browser back to the redirect URL with
     NOTHING in it — no status, no signature. The order id is put in that URL
     by us, and the return handler asks the status API for the outcome.

  4. The webhook is authenticated by an `Authorization` header holding
     SHA256("<username>:<password>"), the pair set when the webhook was created
     in the PhonePe dashboard. That is the only report this provider marks as
     verified — and even then settlement re-fetches the order before a booking
     is confirmed.

  5. Refunds are addressed by the original `merchantOrderId` plus our own
     unique `merchantRefundId`, which is what we store as the provider refund
     id so the refund webhook can find the row.

  Amounts are integers in paise throughout, and PhonePe's minimum is ₹1.
*/

type PhonePeEnv = 'PRODUCTION' | 'SANDBOX';

const HOSTS: Record<PhonePeEnv, { auth: string; pg: string }> = {
  PRODUCTION: {
    auth: 'https://api.phonepe.com/apis/identity-manager',
    pg: 'https://api.phonepe.com/apis/pg',
  },
  SANDBOX: {
    auth: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    pg: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  },
};

/** PhonePe's bounds on how long an order can stay payable, in seconds. */
const MIN_EXPIRE_SECONDS = 300;
const MAX_EXPIRE_SECONDS = 3600;
/** Refresh the token this long before PhonePe says it expires. */
const TOKEN_SKEW_MS = 60_000;

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  /** Epoch seconds. */
  expires_at?: number;
};

type PaymentDetail = {
  transactionId?: string;
  paymentMode?: string;
  state?: string; // PENDING | COMPLETED | FAILED
  amount?: number;
  timestamp?: number;
  errorCode?: string;
  detailedErrorCode?: string;
};

/** An order as the status API and the order webhooks describe it. */
type OrderState = {
  orderId?: string;
  merchantOrderId?: string;
  state?: string; // PENDING | COMPLETED | FAILED
  amount?: number;
  expireAt?: number;
  metaInfo?: Record<string, string>;
  errorCode?: string;
  detailedErrorCode?: string;
  paymentDetails?: PaymentDetail[];
};

/** A refund as the refund webhooks describe it. */
type RefundState = {
  merchantRefundId?: string;
  refundId?: string;
  originalMerchantOrderId?: string;
  state?: string; // PENDING | CONFIRMED | COMPLETED | FAILED
  amount?: number;
  errorCode?: string;
  detailedErrorCode?: string;
};

type ErrorBody = {
  code?: string;
  message?: string;
  success?: boolean;
};

type CallResult<T> = { ok: boolean; status: number; body: T & ErrorBody };

@Injectable()
export class PhonePeProvider implements PaymentProvider {
  readonly name = 'PHONEPE';
  private readonly logger = new Logger(PhonePeProvider.name);
  private token: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const { clientId, clientSecret } = this.credentials();
    return Boolean(clientId && clientSecret);
  }

  /** True once the webhook username and password are both set. */
  webhookConfigured(): boolean {
    const { webhookUsername, webhookPassword } = this.credentials();
    return Boolean(webhookUsername && webhookPassword);
  }

  environment(): PhonePeEnv {
    const raw = this.config.get<string>('PHONEPE_ENV')?.trim().toUpperCase();
    return raw === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
  }

  async createIntent(
    input: CreatePaymentIntentInput,
  ): Promise<CreatePaymentIntentResult> {
    const merchantOrderId = merchantOrderIdFor(input.bookingId);
    const result = await this.call<{
      orderId?: string;
      state?: string;
      expireAt?: number;
      redirectUrl?: string;
    }>('pg', '/checkout/v2/pay', {
      method: 'POST',
      json: {
        merchantOrderId,
        amount: input.amountPaise,
        expireAfter: clampExpiry(input.expiresInSeconds),
        // Read back on the status API and the webhook, and checked against the
        // booking before anything is settled.
        metaInfo: { udf1: input.bookingId },
        paymentFlow: {
          type: 'PG_CHECKOUT',
          merchantUrls: {
            redirectUrl: returnUrlFor(input.returnUrl, merchantOrderId),
          },
        },
      },
    });

    const { body } = result;
    if (!result.ok || !body.redirectUrl) {
      this.throwRefusal('/checkout/v2/pay', result);
    }

    return {
      provider: this.name,
      providerOrderId: merchantOrderId,
      amountPaise: input.amountPaise,
      currency: input.currency,
      status: 'CREATED',
      metadata: {
        checkoutUrl: body.redirectUrl,
        ...(body.orderId ? { phonepeOrderId: body.orderId } : {}),
      },
    };
  }

  checkoutForm(input: CheckoutFormInput): CheckoutForm {
    const url = input.metadata?.checkoutUrl;
    if (!url) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'This payment has no checkout link. Start the payment again.',
      });
    }
    return { action: url, method: 'GET', fields: {} };
  }

  /**
   * The browser coming back from PhonePe. The redirect carries only the order
   * id we put in it ourselves, so there is nothing here to trust — the caller
   * asks the status API what happened.
   */
  parseReturn(rawQuery: string): string | null {
    const params = new URLSearchParams(rawQuery.trim().replace(/^\?/, ''));
    const orderId = params.get('order')?.trim() ?? '';
    return /^[A-Za-z0-9_-]{1,63}$/.test(orderId) ? orderId : null;
  }

  parseNotification(
    rawBody: string,
    headers: Record<string, string | undefined> = {},
  ): GatewayNotification | null {
    let parsed: { event?: string; type?: string; payload?: unknown };
    try {
      parsed = JSON.parse(rawBody) as typeof parsed;
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.payload) return null;

    const verified = this.webhookAuthMatches(headers.authorization);
    const event = String(parsed.event ?? parsed.type ?? '').toLowerCase();

    const refund = parsed.payload as RefundState;
    if (refund.merchantRefundId || event.includes('refund')) {
      if (!refund.merchantRefundId) return null;
      return {
        verified,
        kind: 'refund',
        providerOrderId: refund.originalMerchantOrderId ?? '',
        providerPaymentId: null,
        status: 'PENDING',
        amountPaise: numberOrNull(refund.amount),
        refund: {
          providerRefundId: refund.merchantRefundId,
          providerStatus: (refund.state ?? 'pending').toLowerCase(),
        },
        reason: refund.detailedErrorCode || refund.errorCode || undefined,
      };
    }

    const order = parsed.payload as OrderState;
    if (!order.merchantOrderId) return null;
    const status = mapOrderState(order.state);
    const completed = completedAttempt(order);
    const lastAttempt = order.paymentDetails?.at(-1);
    return {
      verified,
      kind: 'payment',
      providerOrderId: order.merchantOrderId,
      providerPaymentId: completed?.transactionId ?? null,
      status,
      amountPaise: numberOrNull(order.amount),
      bookingId: order.metaInfo?.udf1,
      reason:
        status === 'FAILED'
          ? lastAttempt?.detailedErrorCode ||
            lastAttempt?.errorCode ||
            order.detailedErrorCode ||
            order.errorCode ||
            'failed'
          : undefined,
    };
  }

  /**
   * Legacy verify route. PhonePe gives the browser nothing to verify offline,
   * so this is a lookup: the attempt exists on this order and completed.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const remote = await this.fetchPayment(
      input.providerPaymentId,
      input.providerOrderId,
    );
    const verified =
      remote !== null &&
      remote.providerOrderId === input.providerOrderId &&
      remote.captured;
    return {
      verified,
      status: verified ? 'SUCCESS' : (remote?.status ?? 'FAILED'),
      providerPaymentId: input.providerPaymentId,
    };
  }

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    if (!input.providerOrderId) {
      return {
        providerRefundId: null,
        providerStatus: 'No PhonePe order id is recorded for this payment.',
      };
    }
    const merchantRefundId = merchantRefundIdFor(input.reference);
    const result = await this.call<{ refundId?: string; state?: string }>(
      'pg',
      '/payments/v2/refund',
      {
        method: 'POST',
        json: {
          merchantRefundId,
          originalMerchantOrderId: input.providerOrderId,
          amount: input.amountPaise,
        },
      },
    );

    // A refused refund is reported, not thrown: the caller records PhonePe's
    // words and an admin retries.
    if (!result.ok) {
      const reason = describeError(result.body) || `HTTP ${result.status}`;
      this.logger.error(
        `PhonePe refund rejected for order ${input.providerOrderId}: ${reason} | amount=${input.amountPaise} paise`,
      );
      return { providerRefundId: null, providerStatus: reason };
    }
    return {
      providerRefundId: merchantRefundId,
      providerStatus: (result.body.state ?? 'pending').toLowerCase(),
    };
  }

  async fetchRefund(
    providerRefundId: string,
  ): Promise<{ providerStatus: string; amountPaise: number | null } | null> {
    const result = await this.call<RefundState>(
      'pg',
      `/payments/v2/refund/${encodeURIComponent(providerRefundId)}/status`,
    );
    if (!result.ok) return null;
    return {
      providerStatus: (result.body.state ?? 'pending').toLowerCase(),
      amountPaise: numberOrNull(result.body.amount),
    };
  }

  async fetchOrder(providerOrderId: string): Promise<FetchOrderResult | null> {
    const order = await this.orderStatus(providerOrderId);
    if (!order) return null;
    const status = mapOrderState(order.state);
    const completed = completedAttempt(order);
    return {
      providerOrderId,
      status,
      providerPaymentId:
        status === 'SUCCESS' ? completed?.transactionId : undefined,
      amountPaise: numberOrNull(order.amount) ?? undefined,
    };
  }

  /**
   * PhonePe has no lookup by transaction id, so the attempt is found on its
   * order. Without the order id there is nothing to ask.
   */
  async fetchPayment(
    providerPaymentId: string,
    providerOrderId?: string,
  ): Promise<FetchPaymentResult | null> {
    if (!providerOrderId) return null;
    const order = await this.orderStatus(providerOrderId);
    if (!order) return null;

    const attempt = order.paymentDetails?.find(
      (detail) => detail.transactionId === providerPaymentId,
    );
    if (!attempt) return null;

    const captured =
      mapOrderState(order.state) === 'SUCCESS' &&
      mapOrderState(attempt.state) === 'SUCCESS';
    return {
      providerPaymentId,
      providerOrderId: order.merchantOrderId ?? providerOrderId,
      amountPaise:
        numberOrNull(attempt.amount) ?? numberOrNull(order.amount) ?? 0,
      currency: 'INR',
      captured,
      status: captured ? 'SUCCESS' : mapOrderState(attempt.state),
      bookingId: order.metaInfo?.udf1,
    };
  }

  // --- internals -------------------------------------------------------------

  private async orderStatus(
    merchantOrderId: string,
  ): Promise<OrderState | null> {
    const result = await this.call<OrderState>(
      'pg',
      `/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=true`,
    );
    if (!result.ok) {
      if (result.status >= 500) {
        this.logger.warn(
          `PhonePe status for ${merchantOrderId} failed (HTTP ${result.status}): ${describeError(result.body)}`,
        );
      }
      return null;
    }
    return result.body;
  }

  private webhookAuthMatches(header: string | undefined): boolean {
    const { webhookUsername, webhookPassword } = this.credentials();
    if (!header || !webhookUsername || !webhookPassword) return false;
    const expected = webhookAuthorization(webhookUsername, webhookPassword);
    // Tolerate a scheme word in front of the hash, should PhonePe add one.
    const actual = header.trim().split(/\s+/).at(-1)?.toLowerCase() ?? '';
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private credentials() {
    const read = (key: string) => this.config.get<string>(key)?.trim() ?? '';
    return {
      clientId: read('PHONEPE_CLIENT_ID'),
      clientSecret: read('PHONEPE_CLIENT_SECRET'),
      clientVersion: read('PHONEPE_CLIENT_VERSION') || '1',
      webhookUsername: read('PHONEPE_WEBHOOK_USERNAME'),
      webhookPassword: read('PHONEPE_WEBHOOK_PASSWORD'),
    };
  }

  /** A cached token, or a fresh one. Concurrent callers share one request. */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - TOKEN_SKEW_MS > Date.now()) {
      return this.token.value;
    }
    if (!this.tokenRequest) {
      this.tokenRequest = this.requestToken().finally(() => {
        this.tokenRequest = null;
      });
    }
    return this.tokenRequest;
  }

  private async requestToken(): Promise<string> {
    const { clientId, clientSecret, clientVersion } = this.credentials();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'PhonePe is not configured on the server.',
      });
    }

    let response: Response;
    try {
      response = await fetch(
        `${HOSTS[this.environment()].auth}/v1/oauth/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_version: clientVersion,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
          }).toString(),
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        },
      );
    } catch {
      throw gatewayTimeout();
    }

    const body = (await readJson(response)) as TokenResponse & ErrorBody;
    if (!response.ok || !body?.access_token) {
      this.logger.error(
        `PhonePe token request refused (HTTP ${response.status}, ${this.environment()}): ${describeError(body)}`,
      );
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message:
          'PhonePe rejected the server credentials. Check the client id, secret, version and PHONEPE_ENV.',
      });
    }

    const expiresAt =
      typeof body.expires_at === 'number'
        ? body.expires_at * 1000
        : Date.now() + 10 * 60_000;
    this.token = { value: body.access_token, expiresAt };
    return body.access_token;
  }

  /**
   * One authenticated call. Transport failures throw; an HTTP refusal is
   * returned for the caller to interpret, since "order not found" and
   * "refund refused" are answers, not crashes. A 401 is retried once with a
   * fresh token in case the cached one was revoked early.
   */
  private async call<T>(
    host: 'pg',
    path: string,
    options: { method?: 'GET' | 'POST'; json?: unknown } = {},
    retried = false,
  ): Promise<CallResult<T>> {
    const token = await this.accessToken();

    let response: Response;
    try {
      response = await fetch(`${HOSTS[this.environment()][host]}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `O-Bearer ${token}`,
          Accept: 'application/json',
          ...(options.json ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.json ? JSON.stringify(options.json) : undefined,
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch {
      throw gatewayTimeout();
    }

    if (response.status === 401 && !retried) {
      this.token = null;
      return this.call<T>(host, path, options, true);
    }

    const body = ((await readJson(response)) ?? {}) as T & ErrorBody;
    return { ok: response.ok, status: response.status, body };
  }

  /** Turns a refused order creation into an error the guest can act on. */
  private throwRefusal(path: string, result: CallResult<unknown>): never {
    const reason = describeError(result.body);
    this.logger.error(
      `PhonePe ${path} refused (HTTP ${result.status}): ${reason || 'no body'}`,
    );
    if (result.status === 401) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'PhonePe rejected the server credentials.',
      });
    }
    /*
      403 with a valid token is the account, not the request: PhonePe refuses
      to create orders until the merchant is activated for live payments. That
      is a server problem to name plainly, not something the guest did.
    */
    if (result.status === 403 || /not (active|activated|live)/i.test(reason)) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message:
          'Payments are not enabled on the PhonePe account yet. The merchant needs to complete PhonePe activation.',
      });
    }
    if (result.status >= 500 || result.status === 0) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'PhonePe is not responding right now. Try again in a minute.',
      });
    }
    throw new BadRequestException({
      errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
      message: reason || 'The payment gateway refused this request.',
    });
  }
}

// --- Signing -----------------------------------------------------------------

/** The value PhonePe puts in a webhook's Authorization header. */
export function webhookAuthorization(
  username: string,
  password: string,
): string {
  return createHash('sha256')
    .update(`${username}:${password}`, 'utf8')
    .digest('hex');
}

// --- Field helpers -----------------------------------------------------------

/**
 * Unique per attempt, at most 63 characters of [A-Za-z0-9_-] as PhonePe
 * requires. The booking id leads so an order is recognisable in the PhonePe
 * dashboard; the time suffix lets a failed booking be paid again under a new
 * order.
 */
export function merchantOrderIdFor(
  bookingId: string,
  now = Date.now(),
): string {
  const compact = bookingId.replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  return `BK${compact}_${now.toString(36)}`;
}

/** Unique per refund row; a retried refund is a new row and a new id. */
export function merchantRefundIdFor(reference?: string): string {
  const source = (reference || randomUUID()).replace(/[^A-Za-z0-9]/g, '');
  return `RF${source.slice(0, 60)}`;
}

/** The configured return URL with our order id added, since PhonePe adds none. */
export function returnUrlFor(
  returnUrl: string,
  merchantOrderId: string,
): string {
  const url = new URL(returnUrl);
  url.searchParams.set('order', merchantOrderId);
  return url.toString();
}

export function clampExpiry(seconds: number | undefined): number {
  const value = Number.isFinite(seconds) ? Math.round(seconds!) : 1200;
  return Math.min(MAX_EXPIRE_SECONDS, Math.max(MIN_EXPIRE_SECONDS, value));
}

/**
 * COMPLETED is the only settled state. FAILED is final for the order (it is
 * also what an expired order becomes). Everything else is still open: the
 * guest can retry inside the same PhonePe order until it expires.
 */
export function mapOrderState(state?: string): PaymentIntentStatus {
  const value = (state ?? '').toUpperCase();
  if (value === 'COMPLETED') return 'SUCCESS';
  if (value === 'FAILED') return 'FAILED';
  return 'PENDING';
}

function completedAttempt(order: OrderState): PaymentDetail | undefined {
  return order.paymentDetails?.find(
    (detail) => mapOrderState(detail.state) === 'SUCCESS',
  );
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number)
    ? Math.round(number)
    : null;
}

export function describeError(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const { message, code } = body as ErrorBody;
  return [code, message].filter(Boolean).join(': ');
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 200) };
  }
}

function gatewayTimeout() {
  return new ServiceUnavailableException({
    errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
    message:
      'Payment gateway timed out. Try again without creating a new booking.',
  });
}
