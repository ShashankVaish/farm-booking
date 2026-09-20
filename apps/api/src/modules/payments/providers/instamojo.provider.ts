import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
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
  Instamojo, API v1.1 ("payment requests").

  The shape of this gateway, and what follows from it:

  1. A payment is a *payment request* created server-side with the API key and
     auth token. Instamojo answers with a hosted page URL (`longurl`). The guest
     is simply redirected there — there is no signed form to build, so the
     checkout "form" here is a GET to that URL, and the URL is kept on the
     payment row so it never has to be looked up twice.

  2. After paying, Instamojo sends the browser back to `redirect_url` with
     `payment_id`, `payment_status` and `payment_request_id` in the query
     string. That redirect is NOT signed. It is treated purely as a hint to go
     and look; settlement always re-fetches the payment from the API and checks
     the amount and request id before anything is confirmed.

  3. The webhook IS signed: a form POST whose `mac` is HMAC-SHA1, keyed with the
     private salt, over the other field values sorted by field name and joined
     with `|`. That is the only report this provider marks as verified.

  4. There is no separate test host any more — `test.instamojo.com` does not
     resolve — so every request goes to www.instamojo.com. The base URL is
     configurable only so a future sandbox can be pointed at without a deploy.

  Amount limits are Instamojo's: at least ₹9, and the API refuses less with a
  field error. That is surfaced to the guest as a plain message rather than a
  500, because a ₹1 test listing is exactly how it will first be hit.
*/

const DEFAULT_BASE_URL = 'https://www.instamojo.com/api/1.1/';

/** A payment request as the API returns it. */
type PaymentRequest = {
  id: string;
  status?: string; // Pending | Sent | Completed
  amount?: string;
  longurl?: string;
  shorturl?: string | null;
  purpose?: string;
  payments?: Payment[];
};

/** One payment made against a request. */
type Payment = {
  payment_id: string;
  status?: string; // Credit | Failed
  amount?: string;
  currency?: string;
  payment_request?: string; // URL ending in /payment-requests/<id>/
};

type ApiEnvelope<T> = { success: boolean; message?: unknown } & T;

@Injectable()
export class InstamojoProvider implements PaymentProvider {
  readonly name = 'INSTAMOJO';
  private readonly logger = new Logger(InstamojoProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const { apiKey, authToken } = this.credentials();
    return Boolean(apiKey && authToken);
  }

  async createIntent(
    input: CreatePaymentIntentInput,
  ): Promise<CreatePaymentIntentResult> {
    const body = await this.call<{ payment_request?: PaymentRequest }>(
      'payment-requests/',
      {
        method: 'POST',
        form: {
          purpose: safeText(input.description, 100) || 'Stay booking',
          amount: formatAmount(input.amountPaise),
          buyer_name: safeText(input.customerName, 100) || 'Guest',
          email: input.customerEmail.trim(),
          phone: phoneForInstamojo(input.customerPhone),
          redirect_url: input.returnUrl,
          webhook: input.webhookUrl,
          // One booking, one payment. A repeatable link would let the same
          // guest pay twice and leave us with money to hand back.
          allow_repeated_payments: 'false',
          // We send our own confirmation; two emails for one booking is noise.
          send_email: 'false',
          send_sms: 'false',
        },
      },
    );

    const request = body.payment_request;
    if (!request?.id || !request.longurl) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'Unable to create a payment request.',
      });
    }

    return {
      provider: this.name,
      providerOrderId: request.id,
      amountPaise: toPaise(request.amount) ?? input.amountPaise,
      currency: input.currency,
      status: 'CREATED',
      metadata: { checkoutUrl: request.longurl },
    };
  }

  checkoutForm(input: CheckoutFormInput): CheckoutForm {
    const url = input.metadata?.checkoutUrl;
    if (!url) {
      // Only possible for a row written before this provider existed.
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'This payment has no checkout link. Start the payment again.',
      });
    }
    return { action: url, method: 'GET', fields: {} };
  }

  parseNotification(rawBody: string): GatewayNotification | null {
    const fields = parseBody(rawBody);
    if (!fields) return null;

    const paymentId = fields.payment_id || null;
    const requestId = fields.payment_request_id || '';
    // The redirect says `payment_status`; the webhook says `status`.
    const status = fields.status || fields.payment_status || '';
    if (!requestId || !status) return null;

    const verified =
      typeof fields.mac === 'string' &&
      fields.mac.length > 0 &&
      this.macMatches(fields);

    return {
      verified,
      providerOrderId: requestId,
      providerPaymentId: paymentId,
      status: mapStatus(status),
      amountPaise: toPaise(fields.amount),
      // Instamojo carries no merchant field; the booking is found by request id.
      bookingId: undefined,
    };
  }

  /**
   * Legacy verify route. There is nothing to verify offline, so this is a
   * lookup: the payment exists, belongs to this request, and was credited.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const remote = await this.fetchPayment(input.providerPaymentId);
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
    const body = await this.call<{
      refund?: { id?: string; status?: string };
    }>('refunds/', {
      method: 'POST',
      form: {
        payment_id: input.providerPaymentId,
        /*
          Instamojo requires a reason code. RFD ("duplicate/delayed payment")
          fits a refunded stay no better or worse than the others, and unlike
          QFL/QNR it does not imply a product-quality dispute on the merchant's
          record.
        */
        type: 'RFD',
        body: (input.notes?.trim() || 'Booking cancelled').slice(0, 250),
        refund_amount: formatAmount(input.amountPaise),
      },
      // A refused refund is reported, not thrown: the caller records the
      // gateway's words and an admin retries.
      tolerateFailure: true,
    });

    if (!body.success) {
      const reason = describeMessage(body.message);
      this.logger.error(
        `Instamojo refund rejected for ${input.providerPaymentId}: ${reason} | sent amount=${formatAmount(input.amountPaise)}`,
      );
      return { providerRefundId: null, providerStatus: reason || 'failed' };
    }
    return {
      providerRefundId: body.refund?.id ?? null,
      providerStatus: body.refund?.status ?? 'requested',
    };
  }

  async fetchOrder(providerOrderId: string): Promise<FetchOrderResult | null> {
    const body = await this.call<{ payment_request?: PaymentRequest }>(
      `payment-requests/${encodeURIComponent(providerOrderId)}/`,
      { tolerateFailure: true },
    );
    const request = body.payment_request;
    if (!body.success || !request) return null;

    const credited = request.payments?.find((p) => p.status === 'Credit');
    if (credited) {
      return {
        providerOrderId,
        status: 'SUCCESS',
        providerPaymentId: credited.payment_id,
        amountPaise: toPaise(credited.amount) ?? undefined,
      };
    }
    /*
      A failed attempt does not close the request — the same link can be paid
      again — so it is reported as still pending rather than failed. Marking
      the payment failed here would make the guest start over for nothing.
    */
    return {
      providerOrderId,
      status: 'PENDING',
      amountPaise: toPaise(request.amount) ?? undefined,
    };
  }

  async fetchPayment(
    providerPaymentId: string,
  ): Promise<FetchPaymentResult | null> {
    const body = await this.call<{ payment?: Payment }>(
      `payments/${encodeURIComponent(providerPaymentId)}/`,
      { tolerateFailure: true },
    );
    const payment = body.payment;
    if (!body.success || !payment?.payment_id) return null;

    const status = mapStatus(payment.status);
    return {
      providerPaymentId: payment.payment_id,
      providerOrderId: requestIdFromUrl(payment.payment_request),
      amountPaise: toPaise(payment.amount) ?? 0,
      currency: payment.currency ?? 'INR',
      captured: status === 'SUCCESS',
      status,
    };
  }

  // --- internals -------------------------------------------------------------

  private macMatches(fields: Record<string, string>): boolean {
    const { salt } = this.credentials();
    if (!salt) return false;
    const expected = webhookMac(fields, salt);
    const actual = fields.mac.toLowerCase();
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private credentials() {
    return {
      apiKey: this.config.get<string>('INSTAMOJO_API_KEY')?.trim() ?? '',
      authToken: this.config.get<string>('INSTAMOJO_AUTH_TOKEN')?.trim() ?? '',
      salt: this.config.get<string>('INSTAMOJO_SALT')?.trim() ?? '',
    };
  }

  private baseUrl(): string {
    const raw =
      this.config.get<string>('INSTAMOJO_BASE_URL')?.trim() || DEFAULT_BASE_URL;
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  /**
   * One authenticated call. Throws for transport failures and, unless
   * `tolerateFailure` is set, for a `success: false` answer — translating a
   * field-validation refusal (amount too small, bad email) into a 400 the
   * guest can read rather than a 500 they cannot.
   */
  private async call<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST';
      form?: Record<string, string>;
      tolerateFailure?: boolean;
    } = {},
  ): Promise<ApiEnvelope<T>> {
    const { apiKey, authToken } = this.credentials();
    if (!apiKey || !authToken) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'Instamojo is not configured on the server.',
      });
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'X-Auth-Token': authToken,
          ...(options.form
            ? { 'Content-Type': 'application/x-www-form-urlencoded' }
            : {}),
        },
        body: options.form
          ? new URLSearchParams(options.form).toString()
          : undefined,
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message:
          'Payment gateway timed out. Try again without creating a new booking.',
      });
    }

    const text = await response.text();
    let body: ApiEnvelope<T>;
    try {
      body = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      this.logger.error(
        `Instamojo ${path} returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`,
      );
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'Payment gateway returned an unexpected response.',
      });
    }

    if (!body.success && !options.tolerateFailure) {
      const reason = describeMessage(body.message);
      this.logger.error(
        `Instamojo ${path} refused (HTTP ${response.status}): ${reason}`,
      );
      if (response.status === 401 || /auth token|api key/i.test(reason)) {
        throw new ServiceUnavailableException({
          errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
          message: 'Instamojo rejected the server credentials.',
        });
      }
      /*
        403 with valid credentials is the account, not the request: Instamojo
        refuses to create payment requests until the merchant's KYC is approved
        and payments are activated. Reads (listing requests) work in that state,
        which is what makes it confusing — so it is named here, as a server
        problem, rather than shown to the guest as if they did something wrong.
      */
      if (response.status === 403 || /permission/i.test(reason)) {
        throw new ServiceUnavailableException({
          errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
          message:
            'Payments are not enabled on the Instamojo account yet. The merchant needs to complete Instamojo KYC and activation.',
        });
      }
      // Field errors are the guest's to fix or understand — e.g. the minimum.
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: reason || 'The payment gateway refused this request.',
      });
    }
    return body;
  }
}

// --- Signing -----------------------------------------------------------------

/**
 * Instamojo's webhook MAC: HMAC-SHA1 keyed with the private salt, over the
 * values of every posted field except `mac`, ordered by field name and joined
 * with `|`. Keys are sorted as plain strings, which is what Instamojo does.
 */
export function webhookMac(
  fields: Record<string, string>,
  salt: string,
): string {
  const message = Object.keys(fields)
    .filter((key) => key !== 'mac')
    .sort()
    .map((key) => fields[key])
    .join('|');
  return createHmac('sha1', salt).update(message, 'utf8').digest('hex');
}

// --- Field helpers -----------------------------------------------------------

/** Instamojo wants a plain decimal string, e.g. "600.00". */
export function formatAmount(paise: number): string {
  return (paise / 100).toFixed(2);
}

function toPaise(amount: string | undefined): number | null {
  if (!amount) return null;
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function safeText(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Instamojo accepts an Indian mobile as ten digits or with +91. Anything else
 * is dropped rather than sent, because a malformed phone fails the whole
 * request while a missing one is merely collected on the hosted page.
 */
export function phoneForInstamojo(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return '';
}

/** Credit is the only settled state; everything else is not money in hand. */
export function mapStatus(status?: string): PaymentIntentStatus {
  const value = (status ?? '').toLowerCase();
  if (value === 'credit' || value === 'completed') return 'SUCCESS';
  if (value === 'failed' || value === 'failure') return 'FAILED';
  return 'PENDING';
}

/** `.../api/1.1/payment-requests/<id>/` → `<id>`. */
export function requestIdFromUrl(url: string | undefined): string {
  const match = (url ?? '').match(/payment-requests\/([^/?#]+)/);
  return match?.[1] ?? '';
}

/**
 * The API's `message` is a string for auth problems and an object of
 * field → [errors] for validation. Both are flattened to one readable line.
 */
export function describeMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  if (message && typeof message === 'object') {
    return Object.entries(message as Record<string, unknown>)
      .map(([field, errors]) => {
        const list = Array.isArray(errors) ? errors : [errors];
        return `${field}: ${list.map(String).join(' ')}`;
      })
      .join('; ');
  }
  return '';
}

function parseBody(rawBody: string): Record<string, string> | null {
  const trimmed = rawBody.trim().replace(/^\?/, '');
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [
          k,
          typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '',
        ]),
      );
    } catch {
      return null;
    }
  }
  return Object.fromEntries(new URLSearchParams(trimmed).entries());
}
