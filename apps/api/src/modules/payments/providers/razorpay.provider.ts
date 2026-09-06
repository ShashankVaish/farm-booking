import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { ErrorCodes } from '../../../common/constants/error-codes';
import {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  CreateRefundInput,
  CreateRefundResult,
  PaymentProvider,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from './payment-provider.interface';

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'RAZORPAY';

  constructor(private readonly config: ConfigService) {}

  async createIntent(
    input: CreatePaymentIntentInput,
  ): Promise<CreatePaymentIntentResult> {
    const { keyId, keySecret } = this.requireKeys();
    const response = await fetch('https://api.razorpay.com/v1/orders', {
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
      status: body.status === 'paid' ? 'SUCCESS' : 'CREATED',
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
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${input.providerPaymentId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: this.basicAuth(keyId, keySecret),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amountPaise,
          notes: { reason: input.notes ?? '' },
        }),
      },
    );

    const body = (await response.json()) as {
      id?: string;
      status?: string;
      error?: { description?: string };
    };

    if (!response.ok) {
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

  private safeEqual(expected: string, actual: string): boolean {
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    if (left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  }
}
