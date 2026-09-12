import { ConfigService } from '@nestjs/config';
import {
  PayuProvider,
  formatAmount,
  mapStatus,
  quoteLargeIds,
  requestHash,
  responseHash,
} from './payu.provider';

/*
  The two hash formulas are the whole security model of a hosted checkout: get
  a pipe out of place and either every payment is rejected by PayU, or every
  forged return post is accepted by us. The expected values below were
  computed separately with Node's crypto from PayU's documented strings, so a
  regression here is a real drift from the spec and not a test rewritten to
  match the code.
*/
const KEY = 'gtKFFx';
const SALT = 'eCwWELxi';
const TXNID = 'bk0123456789abcdef0123';

const REQUEST_HASH =
  '95f9020bd8efa3a4ee3ab1c404a018c904c7897b404713145c73b2bdc35963ffd044df356695ca6b32b02b83f09910a51c93ae606e021cd36e11dd1404caec8a';
const RESPONSE_HASH =
  '2de5cfc94e4be7c485b445566cbc99a2b4115c6f5f23e7ebedc3a170ea130e47fa5ce40e8c7c1e0b37d1a6ebdff3e4b67ae99780852daf7095d5aba9ab1865e7';

function config(values: Record<string, string | undefined>) {
  return {
    get: (name: string) => values[name],
  } as unknown as ConfigService;
}

function provider(mode = 'test') {
  return new PayuProvider(
    config({ PAYU_KEY: KEY, PAYU_SALT: SALT, PAYU_MODE: mode }),
  );
}

describe('PayU request hash', () => {
  it('matches PayU’s documented field order, including the six empty slots', () => {
    expect(
      requestHash({
        key: KEY,
        txnid: TXNID,
        amount: '600.00',
        productinfo: 'Sabja house',
        firstname: 'Shashank',
        email: 's@example.com',
        udf1: 'bk-1',
        salt: SALT,
      }),
    ).toBe(REQUEST_HASH);
  });
});

describe('PayU response hash', () => {
  it('is the reversed field order with status in the salt’s slot', () => {
    expect(
      responseHash({
        key: KEY,
        txnid: TXNID,
        amount: '600.00',
        productinfo: 'Sabja house',
        firstname: 'Shashank',
        email: 's@example.com',
        udf1: 'bk-1',
        status: 'success',
        salt: SALT,
      }),
    ).toBe(RESPONSE_HASH);
  });
});

describe('checkoutForm', () => {
  const input = {
    providerOrderId: TXNID,
    bookingId: 'bk-1',
    amountPaise: 60000,
    currency: 'INR',
    description: 'Sabja house',
    customerName: 'Shashank Vaish',
    customerEmail: 's@example.com',
    customerPhone: '+91 99977 60912',
    returnUrl: 'https://www.baagly.com/api/payments/return',
  };

  it('posts to the test gateway in test mode and the live one in live mode', () => {
    expect(provider('test').checkoutForm(input).action).toBe(
      'https://test.payu.in/_payment',
    );
    expect(provider('live').checkoutForm(input).action).toBe(
      'https://secure.payu.in/_payment',
    );
    // Anything that is not exactly "live" must never reach the live gateway.
    expect(provider('LIVE ').checkoutForm(input).action).toBe(
      'https://secure.payu.in/_payment',
    );
    expect(provider('production').checkoutForm(input).action).toBe(
      'https://test.payu.in/_payment',
    );
  });

  it('signs exactly the fields it sends', () => {
    const { fields } = provider().checkoutForm(input);
    expect(fields.hash).toBe(REQUEST_HASH);
    expect(fields.amount).toBe('600.00');
    expect(fields.firstname).toBe('Shashank');
    expect(fields.udf1).toBe('bk-1');
    expect(fields.surl).toBe(input.returnUrl);
    expect(fields.furl).toBe(input.returnUrl);
  });

  it('sends a bare ten-digit phone', () => {
    expect(provider().checkoutForm(input).fields.phone).toBe('9997760912');
    expect(
      provider().checkoutForm({ ...input, customerPhone: null }).fields.phone,
    ).toBe('');
  });

  it('strips characters that would break the hash out of free text', () => {
    // A title with a pipe would make PayU compute a different hash from ours.
    const { fields } = provider().checkoutForm({
      ...input,
      description: 'Sabja | house <br>',
    });
    expect(fields.productinfo).toBe('Sabja house br');
    expect(fields.hash).toBe(requestHash({ ...fields, salt: SALT }));
  });

  it('never produces an amount with more than two decimals', () => {
    expect(formatAmount(60000)).toBe('600.00');
    expect(formatAmount(60050)).toBe('600.50');
    expect(formatAmount(1)).toBe('0.01');
  });

  it('refuses to build a form without credentials', () => {
    const unconfigured = new PayuProvider(config({}));
    expect(unconfigured.isConfigured()).toBe(false);
    expect(() => unconfigured.checkoutForm(input)).toThrow(/not configured/);
  });
});

describe('parseNotification', () => {
  const posted = new URLSearchParams({
    key: KEY,
    txnid: TXNID,
    amount: '600.00',
    productinfo: 'Sabja house',
    firstname: 'Shashank',
    email: 's@example.com',
    udf1: 'bk-1',
    udf2: '',
    udf3: '',
    udf4: '',
    udf5: '',
    status: 'success',
    mihpayid: '403993715531234567',
    hash: RESPONSE_HASH,
  }).toString();

  it('accepts a genuine return post', () => {
    const result = provider().parseNotification(posted);
    expect(result).toMatchObject({
      verified: true,
      providerOrderId: TXNID,
      providerPaymentId: '403993715531234567',
      status: 'SUCCESS',
      amountPaise: 60000,
      bookingId: 'bk-1',
    });
  });

  it('rejects a post whose amount was tampered with', () => {
    // The hash covers the amount, so a changed amount fails verification.
    const tampered = posted.replace('amount=600.00', 'amount=1.00');
    expect(provider().parseNotification(tampered)?.verified).toBe(false);
  });

  it('rejects a post whose status was flipped to success', () => {
    const forged = new URLSearchParams(posted);
    forged.set('status', 'success');
    // Re-sign with a made-up salt, as an attacker without ours would have to.
    forged.set(
      'hash',
      responseHash({
        ...Object.fromEntries(forged.entries()),
        salt: 'guess',
      }),
    );
    expect(provider().parseNotification(forged.toString())?.verified).toBe(
      false,
    );
  });

  it('rejects a post for a different merchant key', () => {
    const other = posted.replace(`key=${KEY}`, 'key=someoneelse');
    expect(provider().parseNotification(other)?.verified).toBe(false);
  });

  it('reads a JSON body the same way', () => {
    const json = JSON.stringify(
      Object.fromEntries(new URLSearchParams(posted)),
    );
    expect(provider().parseNotification(json)?.verified).toBe(true);
  });

  it('returns null for something that is not a PayU post', () => {
    expect(provider().parseNotification('')).toBeNull();
    expect(provider().parseNotification('hello=world')).toBeNull();
    expect(
      provider().parseNotification('{"event":"payment.captured"}'),
    ).toBeNull();
  });

  it('reports a failed attempt with the gateway’s reason', () => {
    const failed = new URLSearchParams(posted);
    failed.set('status', 'failure');
    failed.set('error_Message', 'Bank declined the transaction');
    failed.set(
      'hash',
      responseHash({ ...Object.fromEntries(failed.entries()), salt: SALT }),
    );
    expect(provider().parseNotification(failed.toString())).toMatchObject({
      verified: true,
      status: 'FAILED',
      reason: 'Bank declined the transaction',
    });
  });
});

describe('mapStatus', () => {
  it('treats only success as captured', () => {
    expect(mapStatus('success', 'captured')).toBe('SUCCESS');
    expect(mapStatus('failure', 'failed')).toBe('FAILED');
    expect(mapStatus('pending', 'pending')).toBe('PENDING');
    expect(mapStatus('failure', 'userCancelled')).toBe('FAILED');
    expect(mapStatus(undefined, 'userCancelled')).toBe('CANCELLED');
    expect(mapStatus(undefined, undefined)).toBe('PENDING');
  });
});

describe('quoteLargeIds', () => {
  /*
    The first real test payment failed here. PayU returned
    `"mihpayid": 613345778913123655` as a bare number; JSON.parse rounded it to
    …600 and Prisma then rejected a number for a string column. The id has to
    survive parsing digit-for-digit or every later lookup at PayU misses.
  */
  const raw =
    '{"status":1,"transaction_details":{"mihpayid":613345778913123655,"txnid":"bkabc","amt":"600.00","request_id":"","bank_ref_num":99887766554433221,"status":"success"}}';

  it('keeps an 18-digit id exact', () => {
    const parsed = JSON.parse(quoteLargeIds(raw)) as {
      transaction_details: { mihpayid: unknown; bank_ref_num: unknown };
    };
    expect(parsed.transaction_details.mihpayid).toBe('613345778913123655');
    expect(parsed.transaction_details.bank_ref_num).toBe('99887766554433221');
  });

  it('proves the rounding it guards against', () => {
    const naive = JSON.parse(raw) as {
      transaction_details: { mihpayid: number };
    };
    expect(String(naive.transaction_details.mihpayid)).not.toBe(
      '613345778913123655',
    );
  });

  it('leaves amounts and already-quoted values alone', () => {
    expect(quoteLargeIds('{"amt":"600.00","mihpayid":"12"}')).toBe(
      '{"amt":"600.00","mihpayid":"12"}',
    );
    expect(quoteLargeIds('{"transaction_amount":600.5}')).toBe(
      '{"transaction_amount":600.5}',
    );
  });
});

describe('fetchPayment', () => {
  it('returns the id it was asked about as a string, never the echoed number', async () => {
    const p = new PayuProvider({
      get: (n: string) =>
        ({ PAYU_KEY: KEY, PAYU_SALT: SALT, PAYU_MODE: 'test' })[n],
    } as never);
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      text: () =>
        Promise.resolve(
          '{"status":1,"transaction_details":{"mihpayid":613345778913123655,"txnid":"bkabc","transaction_amount":"600.00","status":"success","unmappedstatus":"captured","udf1":"b1"}}',
        ),
    }) as never;

    const result = await p.fetchPayment('613345778913123655');
    expect(result).toMatchObject({
      providerPaymentId: '613345778913123655',
      providerOrderId: 'bkabc',
      amountPaise: 60000,
      captured: true,
      bookingId: 'b1',
    });
    expect(typeof result?.providerPaymentId).toBe('string');
  });
});
