import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { RazorpayProvider } from './razorpay.provider';

describe('RazorpayProvider signatures', () => {
  const config = {
    get: (key: string) => {
      if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_key';
      if (key === 'RAZORPAY_KEY_SECRET') return 'test_secret';
      if (key === 'RAZORPAY_WEBHOOK_SECRET') return 'whsec';
      return undefined;
    },
  } as unknown as ConfigService;

  const provider = new RazorpayProvider(config);

  it('accepts a valid checkout signature and rejects a mutated one', async () => {
    const orderId = 'order_1';
    const paymentId = 'pay_1';
    const signature = createHmac('sha256', 'test_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    await expect(
      provider.verifyPayment({
        providerOrderId: orderId,
        providerPaymentId: paymentId,
        signature,
      }),
    ).resolves.toMatchObject({ verified: true });
    await expect(
      provider.verifyPayment({
        providerOrderId: orderId,
        providerPaymentId: paymentId,
        signature: '0'.repeat(signature.length),
      }),
    ).resolves.toMatchObject({ verified: false });
  });

  it('verifies webhook signatures against the raw body', () => {
    const raw = '{"event":"payment.captured"}';
    const signature = createHmac('sha256', 'whsec').update(raw).digest('hex');
    expect(provider.verifyWebhookSignature(raw, signature)).toBe(true);
    expect(provider.verifyWebhookSignature(raw, 'nope')).toBe(false);
  });
});
