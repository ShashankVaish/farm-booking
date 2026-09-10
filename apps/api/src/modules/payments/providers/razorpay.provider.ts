import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { ErrorCodes } from '../../../common/constants/error-codes';
import {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  CreateRefundInput,
  CreateRefundResult,
  FetchOrderResult,
  FetchPaymentResult,
  PaymentIntentStatus,
  PaymentProvider,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from './payment-provider.interface';

const PROVIDER_TIMEOUT_MS = 15_000;

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'RAZORPAY';
  private readonly logger = new Logger(RazorpayProvider.name);

  constructor(private readonly config: ConfigService) {}

  async createIntent(
    input: CreatePaymentIntentInput,
  ): Promise<CreatePaymentIntentResult> {
    const { keyId, keySecret } = this.requireKeys();
    const response = await this.request('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: this.basicAuth(keyId, keySecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt.slice(0, 40),
        notes: { bookingId: input.bookingId },
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'Unable to create a payment order.',
      });
    }

    const body = (await response.json()) as {
      id: string;
      amount: number;
      currency: string;
      status: string;
    };

    return {
      provider: this.name,
      providerOrderId: body.id,
      amountPaise: body.amount,
      currency: body.currency,
      status: this.mapOrderStatus(body.status),
    };
  }

  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const { keySecret } = this.requireKeys();
    const expected = createHmac('sha256', keySecret)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest('hex');
    const verified = this.safeEqual(expected, input.signature);

    return Promise.resolve({
      verified,
      status: verified ? 'SUCCESS' : 'FAILED',
      providerPaymentId: input.providerPaymentId,
    });
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) {
      return false;
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return this.safeEqual(expected, signature);
  }

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    const { keyId, keySecret } = this.requireKeys();

    // Razorpay rejects `notes` values that are not strings, and an empty
    // object is fine — but a null/undefined entry makes the whole request
    // "invalid". Only send a note when there is something to say.
    const payload: Record<string, unknown> = {
      amount: input.amountPaise,
      speed: input.speed ?? 'normal',
    };
    const note = input.notes?.trim();
    if (note) {
      payload.notes = { reason: note.slice(0, 250) };
    }

    const response = await this.request(
      `https://api.razorpay.com/v1/payments/${input.providerPaymentId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: this.basicAuth(keyId, keySecret),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    const body = (await response.json()) as {
      id?: string;
      status?: string;
      error?: { code?: string; description?: string; reason?: string; field?: string };
    };

    if (!response.ok) {
      // Without this the only trace of a failed refund is the word "failed"
      // in providerStatus, which is not enough to diagnose anything.
      this.logger.error(
        `Razorpay refund rejected (HTTP ${response.status}) for ${input.providerPaymentId}: ` +
          `code=${body.error?.code ?? '?'} field=${body.error?.field ?? '?'} ` +
          `reason=${body.error?.reason ?? '?'} desc=${body.error?.description ?? '?'} ` +
          `| sent amount=${input.amountPaise} speed=${payload.speed as string}`,
      );
      return {
        providerRefundId: null,
        providerStatus: body.error?.description ?? 'failed',
      };
    }

    return {
      providerRefundId: body.id ?? null,
      providerStatus: body.status ?? 'created',
    };
  }

  async fetchOrder(providerOrderId: string): Promise<FetchOrderResult | null> {
    const { keyId, keySecret } = this.requireKeys();
    const auth = { Authorization: this.basicAuth(keyId, keySecret) };
    const response = await this.request(
      `https://api.razorpay.com/v1/orders/${providerOrderId}`,
      { headers: auth },
    );
    if (!response.ok) {
      return null;
    }
    const order = (await response.json()) as {
      id: string;
      status?: string;
      amount?: number;
    };
    const paymentsResponse = await this.request(
      `https://api.razorpay.com/v1/orders/${providerOrderId}/payments`,
      { headers: auth },
    );
    const payments = paymentsResponse.ok
      ? ((await paymentsResponse.json()) as {
          items?: Array<{ id?: string; status?: string; amount?: number }>;
        })
      : { items: [] };
    const captured = payments.items?.find((item) => item.status === 'captured');
    const failed = payments.items?.find((item) => item.status === 'failed');

    if (order.status === 'paid' || captured) {
      return {
        providerOrderId: order.id,
        status: 'SUCCESS',
        providerPaymentId: captured?.id,
        amountPaise: captured?.amount ?? order.amount,
      };
    }
    if (order.status === 'attempted' && failed && !captured) {
      return {
        providerOrderId: order.id,
        status: 'FAILED',
        amountPaise: order.amount,
      };
    }
    return {
      providerOrderId: order.id,
      status: this.mapOrderStatus(order.status),
      amountPaise: order.amount,
    };
  }

  async fetchPayment(
    providerPaymentId: string,
  ): Promise<FetchPaymentResult | null> {
    const { keyId, keySecret } = this.requireKeys();
    const response = await this.request(
      `https://api.razorpay.com/v1/payments/${providerPaymentId}`,
      { headers: { Authorization: this.basicAuth(keyId, keySecret) } },
    );
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as {
      id: string;
      order_id?: string;
      amount?: number;
      currency?: string;
      status?: string;
      captured?: boolean;
      notes?: { bookingId?: string };
    };
    const captured = body.captured === true || body.status === 'captured';
    return {
      providerPaymentId: body.id,
      providerOrderId: body.order_id ?? '',
      amountPaise: body.amount ?? 0,
      currency: body.currency ?? 'INR',
      captured,
      status: captured
        ? 'SUCCESS'
        : body.status === 'failed'
          ? 'FAILED'
          : 'PENDING',
      bookingId: body.notes?.bookingId,
    };
  }

  private mapOrderStatus(status?: string): PaymentIntentStatus {
    if (status === 'paid') return 'SUCCESS';
    if (status === 'attempted') return 'PENDING';
    return 'CREATED';
  }

  private requireKeys(): { keyId: string; keySecret: string } {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'Razorpay is not configured on the server.',
      });
    }
    return { keyId, keySecret };
  }

  private basicAuth(keyId: string, keySecret: string): string {
    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message:
          'Payment gateway timed out. Try again without creating a new booking.',
      });
    }
  }

  private safeEqual(expected: string, actual: string): boolean {
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    if (left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  }
}
