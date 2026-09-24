import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  PhonePeProvider,
  clampExpiry,
  mapOrderState,
  merchantOrderIdFor,
  merchantRefundIdFor,
  returnUrlFor,
  webhookAuthorization,
} from './phonepe.provider';

const BOOKING_ID = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
const ORDER_ID = 'BK3f2b8c1e4a5d4e6f9a7b1c2d3e4f5a6b_abc';

const ENV: Record<string, string> = {
  PHONEPE_ENV: 'PRODUCTION',
  PHONEPE_CLIENT_ID: 'SUTESTCLIENT',
  PHONEPE_CLIENT_SECRET: 'secret-1',
  PHONEPE_CLIENT_VERSION: '1',
  PHONEPE_WEBHOOK_USERNAME: 'baaglywebhook',
  PHONEPE_WEBHOOK_PASSWORD: 'Str0ngPassw0rd',
};

type Call = { url: string; init: RequestInit };

/**
 * A fake PhonePe. Token requests are answered automatically; every other
 * call takes the next queued response, so each test states exactly what the
 * gateway said.
 */
function gateway(env: Record<string, string> = ENV) {
  const calls: Call[] = [];
  const queue: Array<{ status: number; body: unknown }> = [];
  let tokenCount = 0;

  jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    calls.push({ url, init: init ?? {} });
    if (url.endsWith('/v1/oauth/token')) {
      tokenCount += 1;
      return Promise.resolve(
        json(200, {
          access_token: `token-${tokenCount}`,
          token_type: 'O-Bearer',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
    }
    const next = queue.shift();
    if (!next) throw new Error(`Unexpected call to ${url}`);
    return Promise.resolve(json(next.status, next.body));
  });

  const config = { get: (key: string) => env[key] };
  const provider = new PhonePeProvider(config as never);
  return {
    provider,
    calls,
    apiCalls: () => calls.filter((c) => !c.url.endsWith('/v1/oauth/token')),
    tokenCalls: () => calls.filter((c) => c.url.endsWith('/v1/oauth/token')),
    reply: (status: number, body: unknown) => queue.push({ status, body }),
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const intentInput = {
  bookingId: BOOKING_ID,
  amountPaise: 105000,
  currency: 'INR',
  customerEmail: 'asha@example.com',
  customerName: 'Asha Rao',
  customerPhone: '+91 98765 43210',
  description: 'Lake House',
  receipt: 'bk1',
  returnUrl: 'https://www.baagly.com/api/payments/return',
  webhookUrl: 'https://www.baagly.com/api/payments/webhook',
  expiresInSeconds: 30 * 60,
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('PhonePe authentication', () => {
  it('fetches an O-Bearer token from the live host and reuses it', async () => {
    const { provider, reply, tokenCalls, apiCalls } = gateway();
    reply(200, {
      merchantOrderId: ORDER_ID,
      state: 'PENDING',
      paymentDetails: [],
    });
    reply(200, {
      merchantOrderId: ORDER_ID,
      state: 'PENDING',
      paymentDetails: [],
    });

    await provider.fetchOrder(ORDER_ID);
    await provider.fetchOrder(ORDER_ID);

    expect(tokenCalls()).toHaveLength(1);
    const token = tokenCalls()[0];
    expect(token.url).toBe(
      'https://api.phonepe.com/apis/identity-manager/v1/oauth/token',
    );
    const form = new URLSearchParams(token.init.body as string);
    expect(Object.fromEntries(form)).toEqual({
      client_id: 'SUTESTCLIENT',
      client_version: '1',
      client_secret: 'secret-1',
      grant_type: 'client_credentials',
    });
    expect(apiCalls()[0].url).toBe(
      `https://api.phonepe.com/apis/pg/checkout/v2/order/${ORDER_ID}/status?details=true`,
    );
    expect(
      (apiCalls()[0].init.headers as Record<string, string>).Authorization,
    ).toBe('O-Bearer token-1');
  });

  it('uses the sandbox hosts unless PHONEPE_ENV is PRODUCTION', async () => {
    const { provider, reply, calls } = gateway({ ...ENV, PHONEPE_ENV: '' });
    reply(200, { merchantOrderId: ORDER_ID, state: 'PENDING' });
    await provider.fetchOrder(ORDER_ID);
    expect(calls[0].url).toBe(
      'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
    );
    expect(
      calls[1].url.startsWith(
        'https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/',
      ),
    ).toBe(true);
  });

  it('drops a rejected token and retries once with a fresh one', async () => {
    const { provider, reply, tokenCalls, apiCalls } = gateway();
    reply(401, { code: 'UNAUTHORIZED' });
    reply(200, {
      merchantOrderId: ORDER_ID,
      state: 'COMPLETED',
      amount: 105000,
    });
    const order = await provider.fetchOrder(ORDER_ID);
    expect(order?.status).toBe('SUCCESS');
    expect(tokenCalls()).toHaveLength(2);
    expect(
      (apiCalls()[1].init.headers as Record<string, string>).Authorization,
    ).toBe('O-Bearer token-2');
  });

  it('names a credentials problem when the token is refused', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json(401, { success: false, code: '401' }));
    const provider = new PhonePeProvider({
      get: (key: string) => ENV[key],
    } as never);
    await expect(provider.createIntent(intentInput)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('is not configured without a client id and secret', () => {
    const provider = new PhonePeProvider({ get: () => undefined } as never);
    expect(provider.isConfigured()).toBe(false);
    expect(provider.webhookConfigured()).toBe(false);
  });
});

describe('PhonePe order creation', () => {
  it('creates an order with the booking in udf1 and our order id on the return URL', async () => {
    const { provider, reply, apiCalls } = gateway();
    reply(200, {
      orderId: 'OMO123',
      state: 'PENDING',
      expireAt: 1790000000000,
      redirectUrl: 'https://mercury.phonepe.com/transact/pg?token=abc',
    });

    const intent = await provider.createIntent(intentInput);

    const call = apiCalls()[0];
    expect(call.url).toBe('https://api.phonepe.com/apis/pg/checkout/v2/pay');
    expect(call.init.method).toBe('POST');
    const body = JSON.parse(call.init.body as string) as {
      merchantOrderId: string;
      amount: number;
      expireAfter: number;
      metaInfo: { udf1: string };
      paymentFlow: {
        type: string;
        merchantUrls: { redirectUrl: string };
      };
    };
    expect(body.merchantOrderId).toMatch(/^BK[A-Za-z0-9]+_[a-z0-9]+$/);
    expect(body.merchantOrderId.length).toBeLessThanOrEqual(63);
    expect(body.amount).toBe(105000);
    expect(body.expireAfter).toBe(1800);
    expect(body.metaInfo).toEqual({ udf1: BOOKING_ID });
    expect(body.paymentFlow.type).toBe('PG_CHECKOUT');
    expect(body.paymentFlow.merchantUrls.redirectUrl).toBe(
      `https://www.baagly.com/api/payments/return?order=${body.merchantOrderId}`,
    );

    expect(intent).toEqual({
      provider: 'PHONEPE',
      providerOrderId: body.merchantOrderId,
      amountPaise: 105000,
      currency: 'INR',
      status: 'CREATED',
      metadata: {
        checkoutUrl: 'https://mercury.phonepe.com/transact/pg?token=abc',
        phonepeOrderId: 'OMO123',
      },
    });
  });

  it('turns a field refusal into a message the guest can read', async () => {
    const { provider, reply } = gateway();
    reply(400, { code: 'BAD_REQUEST', message: 'amount must be at least 100' });
    await expect(provider.createIntent(intentInput)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('names an account that is not activated yet as a server problem', async () => {
    const { provider, reply } = gateway();
    reply(403, { code: 'FORBIDDEN', message: 'Merchant is not active' });
    await expect(provider.createIntent(intentInput)).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.stringContaining('not enabled on the PhonePe account'),
      }),
    });
  });

  it('checks out with a plain redirect to the hosted page', () => {
    const provider = new PhonePeProvider({ get: () => undefined } as never);
    expect(
      provider.checkoutForm({
        providerOrderId: ORDER_ID,
        bookingId: BOOKING_ID,
        amountPaise: 105000,
        currency: 'INR',
        description: 'Lake House',
        customerName: 'Asha',
        customerEmail: 'a@x.com',
        returnUrl: 'https://www.baagly.com/api/payments/return',
        metadata: { checkoutUrl: 'https://mercury.phonepe.com/x' },
      }),
    ).toEqual({
      action: 'https://mercury.phonepe.com/x',
      method: 'GET',
      fields: {},
    });
  });
});

describe('PhonePe order status', () => {
  const completed = {
    orderId: 'OMO123',
    merchantOrderId: ORDER_ID,
    state: 'COMPLETED',
    amount: 105000,
    metaInfo: { udf1: BOOKING_ID },
    paymentDetails: [
      { transactionId: 'OM-failed', state: 'FAILED', amount: 105000 },
      { transactionId: 'OM-ok', state: 'COMPLETED', amount: 105000 },
    ],
  };

  it('reports a completed order with the attempt that paid', async () => {
    const { provider, reply } = gateway();
    reply(200, completed);
    await expect(provider.fetchOrder(ORDER_ID)).resolves.toEqual({
      providerOrderId: ORDER_ID,
      status: 'SUCCESS',
      providerPaymentId: 'OM-ok',
      amountPaise: 105000,
    });
  });

  it('reports failed and still-open orders', async () => {
    const { provider, reply } = gateway();
    reply(200, { merchantOrderId: ORDER_ID, state: 'FAILED', amount: 105000 });
    reply(200, { merchantOrderId: ORDER_ID, state: 'PENDING', amount: 105000 });
    expect((await provider.fetchOrder(ORDER_ID))?.status).toBe('FAILED');
    expect((await provider.fetchOrder(ORDER_ID))?.status).toBe('PENDING');
  });

  it('answers null for an order PhonePe does not know', async () => {
    const { provider, reply } = gateway();
    reply(404, { code: 'ORDER_NOT_FOUND' });
    await expect(provider.fetchOrder(ORDER_ID)).resolves.toBeNull();
  });

  it('finds a captured attempt through its order', async () => {
    const { provider, reply } = gateway();
    reply(200, completed);
    await expect(provider.fetchPayment('OM-ok', ORDER_ID)).resolves.toEqual({
      providerPaymentId: 'OM-ok',
      providerOrderId: ORDER_ID,
      amountPaise: 105000,
      currency: 'INR',
      captured: true,
      status: 'SUCCESS',
      bookingId: BOOKING_ID,
    });
  });

  it('does not call a failed attempt captured, even on a completed order', async () => {
    const { provider, reply } = gateway();
    reply(200, completed);
    const attempt = await provider.fetchPayment('OM-failed', ORDER_ID);
    expect(attempt?.captured).toBe(false);
    expect(attempt?.status).toBe('FAILED');
  });

  it('answers null for an attempt not on the order, or with no order id', async () => {
    const { provider, reply } = gateway();
    reply(200, completed);
    await expect(
      provider.fetchPayment('OM-other', ORDER_ID),
    ).resolves.toBeNull();
    await expect(provider.fetchPayment('OM-ok')).resolves.toBeNull();
  });
});

describe('PhonePe refunds', () => {
  it('refunds against the original order under our own refund id', async () => {
    const { provider, reply, apiCalls } = gateway();
    reply(200, { refundId: 'OMR1', amount: 50000, state: 'PENDING' });
    const result = await provider.createRefund({
      providerPaymentId: 'OM-ok',
      providerOrderId: ORDER_ID,
      reference: '0b6f9d2e-1111-2222-3333-444455556666',
      amountPaise: 50000,
    });
    const call = apiCalls()[0];
    expect(call.url).toBe('https://api.phonepe.com/apis/pg/payments/v2/refund');
    expect(JSON.parse(call.init.body as string)).toEqual({
      merchantRefundId: 'RF0b6f9d2e111122223333444455556666',
      originalMerchantOrderId: ORDER_ID,
      amount: 50000,
    });
    expect(result).toEqual({
      providerRefundId: 'RF0b6f9d2e111122223333444455556666',
      providerStatus: 'pending',
    });
  });

  it('reports a refused refund instead of throwing', async () => {
    const { provider, reply } = gateway();
    reply(400, {
      code: 'BAD_REQUEST',
      message: 'Refund amount exceeds balance',
    });
    const result = await provider.createRefund({
      providerPaymentId: 'OM-ok',
      providerOrderId: ORDER_ID,
      amountPaise: 50000,
    });
    expect(result.providerRefundId).toBeNull();
    expect(result.providerStatus).toContain('exceeds balance');
  });

  it('cannot refund without the original order id', async () => {
    const { provider, apiCalls } = gateway();
    const result = await provider.createRefund({
      providerPaymentId: 'OM-ok',
      amountPaise: 50000,
    });
    expect(result.providerRefundId).toBeNull();
    expect(apiCalls()).toHaveLength(0);
  });

  it('reads a refund status by our refund id', async () => {
    const { provider, reply, apiCalls } = gateway();
    reply(200, {
      merchantRefundId: 'RFabc',
      state: 'COMPLETED',
      amount: 50000,
    });
    await expect(provider.fetchRefund('RFabc')).resolves.toEqual({
      providerStatus: 'completed',
      amountPaise: 50000,
    });
    expect(apiCalls()[0].url).toBe(
      'https://api.phonepe.com/apis/pg/payments/v2/refund/RFabc/status',
    );
  });
});

describe('PhonePe webhook', () => {
  const provider = new PhonePeProvider({
    get: (key: string) => ENV[key],
  } as never);
  const goodAuth = webhookAuthorization('baaglywebhook', 'Str0ngPassw0rd');

  const orderCompleted = JSON.stringify({
    event: 'checkout.order.completed',
    payload: {
      orderId: 'OMO123',
      merchantId: 'M1',
      merchantOrderId: ORDER_ID,
      state: 'COMPLETED',
      amount: 105000,
      metaInfo: { udf1: BOOKING_ID },
      paymentDetails: [
        {
          transactionId: 'OM-ok',
          paymentMode: 'UPI_QR',
          state: 'COMPLETED',
          amount: 105000,
        },
      ],
    },
  });

  it('computes the Authorization value as SHA256 of "username:password"', () => {
    expect(webhookAuthorization('user', 'pass')).toBe(
      'ef4c914c591698b268db3c64163eafda7209a630f236ebf0eebf045460df723a',
    );
  });

  it('verifies a genuine order webhook', () => {
    expect(
      provider.parseNotification(orderCompleted, { authorization: goodAuth }),
    ).toEqual({
      verified: true,
      kind: 'payment',
      providerOrderId: ORDER_ID,
      providerPaymentId: 'OM-ok',
      status: 'SUCCESS',
      amountPaise: 105000,
      bookingId: BOOKING_ID,
      reason: undefined,
    });
  });

  it('accepts the hash in upper case or behind a scheme word', () => {
    expect(
      provider.parseNotification(orderCompleted, {
        authorization: goodAuth.toUpperCase(),
      })?.verified,
    ).toBe(true);
    expect(
      provider.parseNotification(orderCompleted, {
        authorization: `SHA256 ${goodAuth}`,
      })?.verified,
    ).toBe(true);
  });

  it('does not verify a webhook with a wrong or missing Authorization', () => {
    const forged = webhookAuthorization('baaglywebhook', 'guess');
    expect(
      provider.parseNotification(orderCompleted, { authorization: forged })
        ?.verified,
    ).toBe(false);
    expect(provider.parseNotification(orderCompleted, {})?.verified).toBe(
      false,
    );
  });

  it('never verifies when no webhook password is configured', () => {
    const unconfigured = new PhonePeProvider({
      get: (key: string) =>
        key === 'PHONEPE_WEBHOOK_PASSWORD' ? '' : ENV[key],
    } as never);
    expect(
      unconfigured.parseNotification(orderCompleted, {
        authorization: webhookAuthorization('baaglywebhook', ''),
      })?.verified,
    ).toBe(false);
  });

  it('carries the failure reason of a failed order', () => {
    const failed = JSON.stringify({
      event: 'checkout.order.failed',
      payload: {
        merchantOrderId: ORDER_ID,
        state: 'FAILED',
        amount: 105000,
        paymentDetails: [
          {
            transactionId: 'OM-x',
            state: 'FAILED',
            errorCode: 'PAYMENT_DECLINED',
            detailedErrorCode: 'INSUFFICIENT_FUNDS',
          },
        ],
      },
    });
    expect(
      provider.parseNotification(failed, { authorization: goodAuth }),
    ).toMatchObject({
      verified: true,
      status: 'FAILED',
      providerPaymentId: null,
      reason: 'INSUFFICIENT_FUNDS',
    });
  });

  it('reads a refund webhook as a refund', () => {
    const refund = JSON.stringify({
      event: 'pg.refund.completed',
      payload: {
        merchantId: 'M1',
        merchantRefundId: 'RFabc',
        originalMerchantOrderId: ORDER_ID,
        refundId: 'OMR1',
        state: 'COMPLETED',
        amount: 50000,
      },
    });
    expect(
      provider.parseNotification(refund, { authorization: goodAuth }),
    ).toMatchObject({
      verified: true,
      kind: 'refund',
      providerOrderId: ORDER_ID,
      refund: { providerRefundId: 'RFabc', providerStatus: 'completed' },
    });
  });

  it('ignores bodies PhonePe would not send', () => {
    expect(provider.parseNotification('payment_id=1&status=Credit')).toBeNull();
    expect(provider.parseNotification('{"event":"x"}')).toBeNull();
    expect(
      provider.parseNotification(
        '{"event":"checkout.order.completed","payload":{}}',
      ),
    ).toBeNull();
  });
});

describe('PhonePe return and field helpers', () => {
  const provider = new PhonePeProvider({ get: () => undefined } as never);

  it('reads only a well-formed order id from the return', () => {
    expect(provider.parseReturn(`order=${ORDER_ID}`)).toBe(ORDER_ID);
    expect(provider.parseReturn(`?order=${ORDER_ID}&x=1`)).toBe(ORDER_ID);
    expect(provider.parseReturn('order=bad%20id')).toBeNull();
    expect(provider.parseReturn('')).toBeNull();
  });

  it('builds order ids within PhonePe limits and unique per attempt', () => {
    const first = merchantOrderIdFor(BOOKING_ID, 1000);
    const second = merchantOrderIdFor(BOOKING_ID, 2000);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{1,63}$/);
    expect(merchantRefundIdFor()).toMatch(/^RF[A-Za-z0-9]{32}$/);
  });

  it('keeps our return URL and adds the order id', () => {
    expect(
      returnUrlFor('https://www.baagly.com/api/payments/return?from=x', 'BK1'),
    ).toBe('https://www.baagly.com/api/payments/return?from=x&order=BK1');
  });

  it('clamps the order expiry to what PhonePe allows', () => {
    expect(clampExpiry(60)).toBe(300);
    expect(clampExpiry(30 * 60)).toBe(1800);
    expect(clampExpiry(24 * 3600)).toBe(3600);
    expect(clampExpiry(undefined)).toBe(1200);
  });

  it('treats only COMPLETED as paid', () => {
    expect(mapOrderState('COMPLETED')).toBe('SUCCESS');
    expect(mapOrderState('FAILED')).toBe('FAILED');
    expect(mapOrderState('PENDING')).toBe('PENDING');
    expect(mapOrderState(undefined)).toBe('PENDING');
  });
});
