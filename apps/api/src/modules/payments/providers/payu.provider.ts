import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
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
  PayU India, hosted checkout ("_payment").

  How this gateway differs from an API-first one, and why the code below is
  shaped the way it is:

  1. There is no "create order" call. The merchant mints a transaction id
     (`txnid`, max 25 chars) locally, signs the payment parameters with the
     salt, and the BROWSER posts them to PayU. So `createIntent` touches no
     network — it just issues the id.

  2. PayU sends the browser back with a form POST to the merchant's success or
     failure URL, and optionally the same fields to a webhook. Both carry a
     `hash` computed with the salt in *reverse* field order. `parseNotification`
     checks that hash; it proves PayU sent the report, nothing more.

  3. The authoritative state lives behind `postservice.php`. `verify_payment`
     looks a transaction up by `txnid`, `check_payment` by PayU's own id
     (`mihpayid`). The service re-fetches through these before settling, so a
     forged or replayed return post can never confirm a booking by itself.

  Field naming follows PayU's documentation exactly, including the odd ones
  (`productinfo`, `firstname`, `surl`/`furl`), because the hash is computed
  over them in a fixed order and any drift breaks it silently.
*/

type PayuMode = 'test' | 'live';

const ENDPOINTS: Record<PayuMode, { checkout: string; info: string }> = {
  test: {
    checkout: 'https://test.payu.in/_payment',
    info: 'https://test.payu.in/merchant/postservice.php?form=2',
  },
  live: {
    checkout: 'https://secure.payu.in/_payment',
    info: 'https://info.payu.in/merchant/postservice.php?form=2',
  },
};

/** One transaction as PayU reports it from the info API. */
type PayuTransaction = {
  mihpayid?: string;
  txnid?: string;
  amt?: string;
  transaction_amount?: string;
  status?: string;
  unmappedstatus?: string;
  udf1?: string;
  error_Message?: string;
  request_id?: string;
};

/** The envelope every info-API command answers with. */
type PayuInfoResponse = PayuTransaction & {
  status?: number | string;
  msg?: string;
  transaction_details?: unknown;
};

@Injectable()
export class PayuProvider implements PaymentProvider {
  readonly name = 'PAYU';
  private readonly logger = new Logger(PayuProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('PAYU_KEY')?.trim() &&
      this.config.get<string>('PAYU_SALT')?.trim(),
    );
  }

  createIntent(
    input: CreatePaymentIntentInput,
  ): Promise<CreatePaymentIntentResult> {
    this.requireKeys();
    /*
      PayU caps txnid at 25 characters and requires it to be unique per
      attempt for the merchant, forever. 20 random hex characters is 80 bits —
      a collision is not a practical concern — and the prefix makes the ids
      recognisable in PayU's dashboard.
    */
    const txnid = `bk${randomBytes(10).toString('hex')}`;
    return Promise.resolve({
      provider: this.name,
      providerOrderId: txnid,
      amountPaise: input.amountPaise,
      currency: input.currency,
      status: 'CREATED',
    });
  }

  checkoutForm(input: CheckoutFormInput): CheckoutForm {
    const { key, salt } = this.requireKeys();
    const amount = formatAmount(input.amountPaise);
    /*
      PayU rejects several characters in these free-text fields and, worse,
      includes them in the hash — so a title with a stray "|" would produce a
      hash PayU computes differently. They are cleaned before signing.
    */
    const productinfo = safeText(input.description, 100) || 'Stay booking';
    const firstname = safeText(firstWord(input.customerName), 60) || 'Guest';
    const email = input.customerEmail.trim();
    const udf1 = input.bookingId;

    const fields: Record<string, string> = {
      key,
      txnid: input.providerOrderId,
      amount,
      productinfo,
      firstname,
      email,
      phone: digitsOnly(input.customerPhone ?? ''),
      udf1,
      udf2: '',
      udf3: '',
      udf4: '',
      udf5: '',
      surl: input.returnUrl,
      furl: input.returnUrl,
    };
    fields.hash = requestHash({ ...fields, salt });

    return { action: this.endpoints().checkout, fields };
  }

  parseNotification(rawBody: string): GatewayNotification | null {
    const fields = parseBody(rawBody);
    if (!fields || !fields.txnid || !fields.status) {
      return null;
    }
    const { key, salt } = this.requireKeys();

    const verified =
      fields.key === key &&
      typeof fields.hash === 'string' &&
      safeEqual(responseHash({ ...fields, salt }), fields.hash.toLowerCase());

    const amountPaise = toPaise(fields.amount);
    return {
      verified,
      providerOrderId: fields.txnid,
      providerPaymentId: fields.mihpayid || null,
      status: mapStatus(fields.status, fields.unmappedstatus),
      amountPaise,
      bookingId: fields.udf1 || undefined,
      reason: fields.error_Message || fields.field9 || undefined,
    };
  }

  /**
   * Used by the legacy verify route. PayU gives the browser no signature of
   * its own to hand back, so verification here is a live lookup: the payment
   * exists at PayU, belongs to this txnid, and was captured.
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
    const { key, salt } = this.requireKeys();
    // PayU needs a merchant-side reference per refund request, unique across
    // retries of the same payment, or it treats a retry as a duplicate.
    const token = `rf${randomBytes(8).toString('hex')}`;
    const body = await this.info({
      key,
      command: 'cancel_refund_transaction',
      var1: input.providerPaymentId,
      var2: token,
      var3: formatAmount(input.amountPaise),
      hash: commandHash(
        key,
        'cancel_refund_transaction',
        input.providerPaymentId,
        salt,
      ),
    });

    if (!body || Number(body.status) !== 1) {
      this.logger.error(
        `PayU refund rejected for ${input.providerPaymentId}: ${
          body?.msg ?? 'no response'
        } | sent amount=${formatAmount(input.amountPaise)}`,
      );
      return {
        providerRefundId: null,
        providerStatus: body?.msg ?? 'failed',
      };
    }

    return {
      providerRefundId: body.request_id ? String(body.request_id) : token,
      providerStatus: body.msg ?? 'queued',
    };
  }

  async fetchOrder(providerOrderId: string): Promise<FetchOrderResult | null> {
    const { key, salt } = this.requireKeys();
    const body = await this.info({
      key,
      command: 'verify_payment',
      var1: providerOrderId,
      hash: commandHash(key, 'verify_payment', providerOrderId, salt),
    });
    const txn = pickTransaction(body, providerOrderId);
    if (!txn) {
      return null;
    }
    const status = mapStatus(txn.status, txn.unmappedstatus);
    return {
      providerOrderId,
      status,
      providerPaymentId: txn.mihpayid || undefined,
      amountPaise: toPaise(txn.transaction_amount ?? txn.amt) ?? undefined,
    };
  }

  async fetchPayment(
    providerPaymentId: string,
  ): Promise<FetchPaymentResult | null> {
    const { key, salt } = this.requireKeys();
    const body = await this.info({
      key,
      command: 'check_payment',
      var1: providerPaymentId,
      hash: commandHash(key, 'check_payment', providerPaymentId, salt),
    });
    const txn = pickTransaction(body);
    if (!txn?.txnid) {
      return null;
    }
    const status = mapStatus(txn.status, txn.unmappedstatus);
    return {
      // The id we were asked about is authoritative; the echoed one is the
      // same value and only exists to be cross-checked.
      providerPaymentId,
      providerOrderId: txn.txnid,
      amountPaise: toPaise(txn.transaction_amount ?? txn.amt) ?? 0,
      currency: 'INR',
      captured: status === 'SUCCESS',
      status,
      bookingId: txn.udf1 || undefined,
    };
  }

  private endpoints() {
    const mode = (this.config.get<string>('PAYU_MODE') ?? 'test')
      .trim()
      .toLowerCase();
    return ENDPOINTS[mode === 'live' ? 'live' : 'test'];
  }

  private requireKeys(): { key: string; salt: string } {
    const key = this.config.get<string>('PAYU_KEY')?.trim();
    const salt = this.config.get<string>('PAYU_SALT')?.trim();
    if (!key || !salt) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'PayU is not configured on the server.',
      });
    }
    return { key, salt };
  }

  /** One call to PayU's merchant info API. Returns null on a non-JSON body. */
  private async info(
    params: Record<string, string>,
  ): Promise<PayuInfoResponse | null> {
    let response: Response;
    try {
      response = await fetch(this.endpoints().info, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
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
    try {
      return JSON.parse(quoteLargeIds(text)) as PayuInfoResponse;
    } catch {
      this.logger.error(
        `PayU ${params.command} returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`,
      );
      return null;
    }
  }
}

// --- Hashing -----------------------------------------------------------------

/**
 * Request hash, exactly as PayU specifies:
 *   sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 * The six empty pipes are udf6–udf10 plus one reserved slot. They are not
 * optional: leaving them out gives a hash PayU will reject.
 */
export function requestHash(f: Record<string, string>): string {
  const parts = [
    f.key,
    f.txnid,
    f.amount,
    f.productinfo,
    f.firstname,
    f.email,
    f.udf1 ?? '',
    f.udf2 ?? '',
    f.udf3 ?? '',
    f.udf4 ?? '',
    f.udf5 ?? '',
    '',
    '',
    '',
    '',
    '',
    f.salt,
  ];
  return sha512(parts.join('|'));
}

/**
 * Response hash: the same fields in REVERSE, with `status` in place of the
 * salt's slot and the salt first:
 *   sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 */
export function responseHash(f: Record<string, string>): string {
  const parts = [
    f.salt,
    f.status,
    '',
    '',
    '',
    '',
    '',
    f.udf5 ?? '',
    f.udf4 ?? '',
    f.udf3 ?? '',
    f.udf2 ?? '',
    f.udf1 ?? '',
    f.email,
    f.firstname,
    f.productinfo,
    f.amount,
    f.txnid,
    f.key,
  ];
  return sha512(parts.join('|'));
}

/** Hash for the merchant info API: sha512(key|command|var1|SALT). */
function commandHash(
  key: string,
  command: string,
  var1: string,
  salt: string,
): string {
  return sha512(`${key}|${command}|${var1}|${salt}`);
}

function sha512(value: string): string {
  return createHash('sha512').update(value, 'utf8').digest('hex');
}

function safeEqual(expected: string, actual: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

// --- Field helpers -----------------------------------------------------------

/**
 * PayU's info API emits its identifiers as bare JSON numbers — `"mihpayid":
 * 403993715531234567` — and they are 18 digits long. That is past 2^53, so
 * `JSON.parse` silently rounds them: the id comes out ending in `…600` and no
 * longer matches anything PayU knows. The digits are wrapped in quotes in the
 * raw text, before parsing, so they arrive as the strings they always were.
 *
 * Only the three identifier fields are touched; amounts stay numeric.
 */
export function quoteLargeIds(json: string): string {
  return json.replace(
    /"(mihpayid|request_id|bank_ref_num)"\s*:\s*(\d+)(?=\s*[,}])/g,
    '"$1":"$2"',
  );
}

/** PayU wants a plain decimal string with two places, e.g. "600.00". */
export function formatAmount(paise: number): string {
  return (paise / 100).toFixed(2);
}

function toPaise(amount: string | undefined): number | null {
  if (!amount) return null;
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** PayU disallows a handful of characters in free text, and `|` breaks the hash. */
function safeText(value: string, max: number): string {
  return value
    .replace(/[|<>"'&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function firstWord(name: string): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(-10);
}

/**
 * PayU's `status` is the verdict; `unmappedstatus` is the finer-grained state.
 * Only a `success` counts as captured — everything else is at best pending.
 */
export function mapStatus(
  status?: string,
  unmapped?: string,
): PaymentIntentStatus {
  const verdict = (status ?? '').toLowerCase();
  const detail = (unmapped ?? '').toLowerCase();
  if (verdict === 'success' || detail === 'captured') return 'SUCCESS';
  if (verdict === 'failure' || verdict === 'failed') return 'FAILED';
  if (detail === 'usercancelled' || detail === 'cancelled') return 'CANCELLED';
  if (detail === 'dropped' || detail === 'bounced') return 'FAILED';
  if (
    verdict === 'pending' ||
    detail === 'pending' ||
    detail === 'in progress'
  ) {
    return 'PENDING';
  }
  return 'PENDING';
}

/**
 * The info API wraps the transaction two different ways: `verify_payment`
 * keys `transaction_details` by txnid, `check_payment` returns the object
 * directly. Both are handled so callers do not care which command ran.
 */
function pickTransaction(
  body: { transaction_details?: unknown; status?: number | string } | null,
  txnid?: string,
): PayuTransaction | null {
  if (!body || Number(body.status) !== 1 || !body.transaction_details)
    return null;
  const details = body.transaction_details as Record<string, unknown>;
  if (
    typeof details.status === 'string' ||
    typeof details.mihpayid === 'string'
  ) {
    return details;
  }
  const entry = txnid ? details[txnid] : Object.values(details)[0];
  return entry && typeof entry === 'object' ? entry : null;
}

/** PayU posts `application/x-www-form-urlencoded`; some relays re-encode as JSON. */
function parseBody(rawBody: string): Record<string, string> | null {
  const trimmed = rawBody.trim();
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
