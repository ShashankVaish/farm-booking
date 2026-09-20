import { ConfigService } from '@nestjs/config';
import {
  InstamojoProvider,
  describeMessage,
  formatAmount,
  mapStatus,
  phoneForInstamojo,
  requestIdFromUrl,
  webhookMac,
} from './instamojo.provider';

/*
  The webhook MAC is the only signature Instamojo gives us, so it gets a fixed
  vector computed separately with Node's crypto from Instamojo's documented
  rule (HMAC-SHA1 with the salt over field values sorted by name, joined by
  "|"). The salt below is a test constant, not a live credential.
*/
const SALT = '6e41ab2ea624448c80ede91ed15fa871';
const KEY = 'test-api-key';
const TOKEN = 'test-auth-token';

const WEBHOOK_FIELDS = {
  amount: '600.00',
  buyer: 's@example.com',
  buyer_name: 'Shashank',
  buyer_phone: '+919997760912',
  currency: 'INR',
  fees: '12.00',
  longurl: 'https://www.instamojo.com/@baagly/abc123',
  payment_id: 'MOJO6a01005A31448756',
  payment_request_id: 'abc123def456',
  purpose: 'Sabja house',
  shorturl: 'https://imjo.in/xyz',
  status: 'Credit',
};
const WEBHOOK_MAC = '77b57279f79ba16949989c2a537639a6462026d5';

function config(values: Record<string, string | undefined>) {
  return { get: (name: string) => values[name] } as unknown as ConfigService;
}

function provider(values: Record<string, string | undefined> = {}) {
  return new InstamojoProvider(
    config({
      INSTAMOJO_API_KEY: KEY,
      INSTAMOJO_AUTH_TOKEN: TOKEN,
      INSTAMOJO_SALT: SALT,
      ...values,
    }),
  );
}

/** Stubs `fetch`, recording each call so headers and bodies can be asserted. */
function mockFetch(
  responses: Array<{ status?: number; body: unknown }>,
): jest.Mock {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = jest.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift() ?? { status: 500, body: {} };
    return Promise.resolve({
      status: next.status ?? 200,
      text: () => Promise.resolve(JSON.stringify(next.body)),
    });
  });
  global.fetch = fn as never;
  (fn as jest.Mock & { calls: typeof calls }).calls = calls;
  return fn;
}

const intentInput = {
  bookingId: 'b1',
  amountPaise: 60000,
  currency: 'INR',
  customerEmail: 's@example.com',
  customerName: 'Shashank Vaish',
  customerPhone: '+91 99977 60912',
  description: 'Sabja house',
  receipt: 'bkabc',
  returnUrl: 'https://www.baagly.com/api/payments/return',
  webhookUrl: 'https://www.baagly.com/api/payments/webhook',
};

describe('webhook MAC', () => {
  it('matches the vector computed independently', () => {
    expect(webhookMac(WEBHOOK_FIELDS, SALT)).toBe(WEBHOOK_MAC);
  });

  it('ignores the mac field itself when signing', () => {
    expect(webhookMac({ ...WEBHOOK_FIELDS, mac: 'anything' }, SALT)).toBe(
      WEBHOOK_MAC,
    );
  });
});

describe('createIntent', () => {
  it('creates a payment request and keeps the hosted URL', async () => {
    const fetch = mockFetch([
      {
        body: {
          success: true,
          payment_request: {
            id: 'abc123def456',
            status: 'Pending',
            amount: '600.00',
            longurl: 'https://www.instamojo.com/@baagly/abc123def456',
          },
        },
      },
    ]);

    const result = await provider().createIntent(intentInput);
    expect(result).toMatchObject({
      provider: 'INSTAMOJO',
      providerOrderId: 'abc123def456',
      amountPaise: 60000,
      status: 'CREATED',
      metadata: {
        checkoutUrl: 'https://www.instamojo.com/@baagly/abc123def456',
      },
    });

    const { url, init } = (
      fetch as jest.Mock & { calls: Array<{ url: string; init: RequestInit }> }
    ).calls[0];
    expect(url).toBe('https://www.instamojo.com/api/1.1/payment-requests/');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Api-Key']).toBe(KEY);
    expect(headers['X-Auth-Token']).toBe(TOKEN);

    const sent = Object.fromEntries(new URLSearchParams(init.body as string));
    expect(sent.amount).toBe('600.00');
    expect(sent.purpose).toBe('Sabja house');
    expect(sent.buyer_name).toBe('Shashank Vaish');
    expect(sent.email).toBe('s@example.com');
    expect(sent.phone).toBe('9997760912');
    expect(sent.redirect_url).toBe(intentInput.returnUrl);
    expect(sent.webhook).toBe(intentInput.webhookUrl);
    // One booking, one payment; and no duplicate emails from the gateway.
    expect(sent.allow_repeated_payments).toBe('false');
    expect(sent.send_email).toBe('false');
  });

  it('turns a field refusal into a message the guest can read, not a 500', async () => {
    // Instamojo's minimum is ₹9 — a ₹1 test listing hits exactly this.
    mockFetch([
      {
        status: 400,
        body: {
          success: false,
          message: {
            amount: ['Ensure this value is greater than or equal to 9.'],
          },
        },
      },
    ]);
    await expect(
      provider().createIntent({ ...intentInput, amountPaise: 100 }),
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({
        message: 'amount: Ensure this value is greater than or equal to 9.',
      }),
    });
  });

  it('reports bad credentials as a server problem, not the guest’s', async () => {
    mockFetch([
      { status: 401, body: { success: false, message: 'Invalid Auth Token.' } },
    ]);
    await expect(provider().createIntent(intentInput)).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({
        message: 'Instamojo rejected the server credentials.',
      }),
    });
  });

  it('names an unactivated account as a server problem, not the guest’s', async () => {
    /*
      Seen live: valid credentials, reads return 200, but creating a payment
      request returns 403 "You do not have permission to perform this action."
      until Instamojo approves the merchant's KYC.
    */
    mockFetch([
      {
        status: 403,
        body: {
          success: false,
          message: 'You do not have permission to perform this action.',
        },
      },
    ]);
    await expect(provider().createIntent(intentInput)).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({
        message: expect.stringContaining('complete Instamojo KYC'),
      }),
    });
  });

  it('refuses to call out without credentials', async () => {
    const bare = provider({ INSTAMOJO_API_KEY: '', INSTAMOJO_AUTH_TOKEN: '' });
    expect(bare.isConfigured()).toBe(false);
    await expect(bare.createIntent(intentInput)).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Instamojo is not configured on the server.',
      }),
    });
  });

  it('honours a custom base URL', async () => {
    const fetch = mockFetch([
      {
        body: {
          success: true,
          payment_request: { id: 'x', longurl: 'https://sandbox/x' },
        },
      },
    ]);
    await provider({
      INSTAMOJO_BASE_URL: 'https://sandbox.example/api/1.1',
    }).createIntent(intentInput);
    expect(fetch.mock.calls[0][0]).toBe(
      'https://sandbox.example/api/1.1/payment-requests/',
    );
  });
});

describe('checkoutForm', () => {
  it('is a plain redirect to the stored hosted URL', () => {
    expect(
      provider().checkoutForm({
        providerOrderId: 'abc',
        bookingId: 'b1',
        amountPaise: 60000,
        currency: 'INR',
        description: 'x',
        customerName: 'x',
        customerEmail: 'x@y.z',
        returnUrl: 'r',
        metadata: { checkoutUrl: 'https://www.instamojo.com/@baagly/abc' },
      }),
    ).toEqual({
      action: 'https://www.instamojo.com/@baagly/abc',
      method: 'GET',
      fields: {},
    });
  });

  it('refuses a row with no stored URL rather than sending the guest nowhere', () => {
    expect(() =>
      provider().checkoutForm({
        providerOrderId: 'abc',
        bookingId: 'b1',
        amountPaise: 1,
        currency: 'INR',
        description: 'x',
        customerName: 'x',
        customerEmail: 'x@y.z',
        returnUrl: 'r',
        metadata: null,
      }),
    ).toThrow(/no checkout link/);
  });
});

describe('parseNotification', () => {
  it('verifies a genuine webhook', () => {
    const body = new URLSearchParams({
      ...WEBHOOK_FIELDS,
      mac: WEBHOOK_MAC,
    }).toString();
    expect(provider().parseNotification(body)).toMatchObject({
      verified: true,
      providerOrderId: 'abc123def456',
      providerPaymentId: 'MOJO6a01005A31448756',
      status: 'SUCCESS',
      amountPaise: 60000,
    });
  });

  it('rejects a webhook whose status was flipped', () => {
    const body = new URLSearchParams({
      ...WEBHOOK_FIELDS,
      status: 'Credit',
      amount: '1.00',
      mac: WEBHOOK_MAC,
    }).toString();
    expect(provider().parseNotification(body)?.verified).toBe(false);
  });

  it('rejects a webhook signed with the wrong salt', () => {
    const forged = webhookMac(WEBHOOK_FIELDS, 'someone-elses-salt');
    const body = new URLSearchParams({
      ...WEBHOOK_FIELDS,
      mac: forged,
    }).toString();
    expect(provider().parseNotification(body)?.verified).toBe(false);
  });

  it('reads the browser redirect as an unverified hint', () => {
    // Exactly what Instamojo appends to redirect_url. No mac, so no trust —
    // but the ids are enough for the service to go and check.
    const query =
      'payment_id=MOJO6a01005A31448756&payment_status=Credit&payment_request_id=abc123def456';
    expect(provider().parseNotification(query)).toMatchObject({
      verified: false,
      providerOrderId: 'abc123def456',
      providerPaymentId: 'MOJO6a01005A31448756',
      status: 'SUCCESS',
    });
    // With a leading "?" too, since that is how a raw query arrives.
    expect(provider().parseNotification(`?${query}`)?.providerOrderId).toBe(
      'abc123def456',
    );
  });

  it('maps a failed redirect', () => {
    expect(
      provider().parseNotification(
        'payment_id=MOJO1&payment_status=Failed&payment_request_id=abc',
      )?.status,
    ).toBe('FAILED');
  });

  it('returns null for anything that is not from Instamojo', () => {
    expect(provider().parseNotification('')).toBeNull();
    expect(provider().parseNotification('hello=world')).toBeNull();
    expect(
      provider().parseNotification('{"event":"payment.captured"}'),
    ).toBeNull();
  });
});

describe('fetchPayment', () => {
  it('reads the request id out of the payment_request URL', async () => {
    mockFetch([
      {
        body: {
          success: true,
          payment: {
            payment_id: 'MOJO6a01005A31448756',
            status: 'Credit',
            amount: '600.00',
            currency: 'INR',
            payment_request:
              'https://www.instamojo.com/api/1.1/payment-requests/abc123def456/',
          },
        },
      },
    ]);
    expect(await provider().fetchPayment('MOJO6a01005A31448756')).toMatchObject(
      {
        providerPaymentId: 'MOJO6a01005A31448756',
        providerOrderId: 'abc123def456',
        amountPaise: 60000,
        captured: true,
        status: 'SUCCESS',
      },
    );
  });

  it('is null for an unknown payment rather than throwing', async () => {
    mockFetch([
      { status: 404, body: { success: false, message: 'Not found' } },
    ]);
    expect(await provider().fetchPayment('nope')).toBeNull();
  });
});

describe('fetchOrder', () => {
  it('is SUCCESS when a credited payment exists on the request', async () => {
    mockFetch([
      {
        body: {
          success: true,
          payment_request: {
            id: 'abc',
            status: 'Completed',
            amount: '600.00',
            payments: [
              { payment_id: 'MOJO_failed', status: 'Failed', amount: '600.00' },
              { payment_id: 'MOJO_ok', status: 'Credit', amount: '600.00' },
            ],
          },
        },
      },
    ]);
    expect(await provider().fetchOrder('abc')).toMatchObject({
      status: 'SUCCESS',
      providerPaymentId: 'MOJO_ok',
      amountPaise: 60000,
    });
  });

  it('stays PENDING after a failed attempt, so the guest can retry the same link', async () => {
    mockFetch([
      {
        body: {
          success: true,
          payment_request: {
            id: 'abc',
            status: 'Pending',
            amount: '600.00',
            payments: [
              { payment_id: 'MOJO_failed', status: 'Failed', amount: '600.00' },
            ],
          },
        },
      },
    ]);
    expect((await provider().fetchOrder('abc'))?.status).toBe('PENDING');
  });
});

describe('createRefund', () => {
  it('posts a refund with a reason code and reports the gateway id', async () => {
    const fetch = mockFetch([
      {
        body: {
          success: true,
          refund: { id: 'C5c0751269', status: 'Refunded' },
        },
      },
    ]);
    const result = await provider().createRefund({
      providerPaymentId: 'MOJO1',
      amountPaise: 60000,
      notes: 'Guest cancelled',
    });
    expect(result).toEqual({
      providerRefundId: 'C5c0751269',
      providerStatus: 'Refunded',
    });
    const sent = Object.fromEntries(
      new URLSearchParams(fetch.mock.calls[0][1].body as string),
    );
    expect(sent).toMatchObject({
      payment_id: 'MOJO1',
      type: 'RFD',
      refund_amount: '600.00',
      body: 'Guest cancelled',
    });
  });

  it('reports a refusal instead of throwing, so the admin sees the words', async () => {
    mockFetch([
      {
        status: 400,
        body: {
          success: false,
          message: { payment_id: ['Refund already exists'] },
        },
      },
    ]);
    expect(
      await provider().createRefund({
        providerPaymentId: 'MOJO1',
        amountPaise: 60000,
      }),
    ).toEqual({
      providerRefundId: null,
      providerStatus: 'payment_id: Refund already exists',
    });
  });
});

describe('helpers', () => {
  it('formats amounts and phones the way the API wants', () => {
    expect(formatAmount(60000)).toBe('600.00');
    expect(formatAmount(1)).toBe('0.01');
    expect(phoneForInstamojo('+91 99977 60912')).toBe('9997760912');
    expect(phoneForInstamojo('9997760912')).toBe('9997760912');
    expect(phoneForInstamojo('12345')).toBe('');
    expect(phoneForInstamojo(null)).toBe('');
  });

  it('treats only Credit as money in hand', () => {
    expect(mapStatus('Credit')).toBe('SUCCESS');
    expect(mapStatus('Completed')).toBe('SUCCESS');
    expect(mapStatus('Failed')).toBe('FAILED');
    expect(mapStatus('Pending')).toBe('PENDING');
    expect(mapStatus(undefined)).toBe('PENDING');
  });

  it('extracts request ids and flattens error messages', () => {
    expect(
      requestIdFromUrl(
        'https://www.instamojo.com/api/1.1/payment-requests/abc123/',
      ),
    ).toBe('abc123');
    expect(requestIdFromUrl(undefined)).toBe('');
    expect(describeMessage('Invalid Auth Token.')).toBe('Invalid Auth Token.');
    expect(describeMessage({ amount: ['too small'], email: ['invalid'] })).toBe(
      'amount: too small; email: invalid',
    );
    expect(describeMessage(undefined)).toBe('');
  });
});
