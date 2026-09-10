import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MailService } from './mail.service';
import { maskEmail, maskSubject } from './smtp.transport';
import type { MailTransport, OutboundEmail } from './mail-transport.interface';

function configOf(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function transportThat(behaviour: 'ok' | 'throws'): MailTransport & {
  sent: OutboundEmail[];
} {
  const sent: OutboundEmail[] = [];
  return {
    name: 'fake',
    sent,
    send(email: OutboundEmail) {
      if (behaviour === 'throws') {
        return Promise.reject(new Error('535 authentication failed'));
      }
      sent.push(email);
      return Promise.resolve();
    },
  };
}

const message: OutboundEmail = {
  to: 'guest@example.com',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
};

describe('maskEmail', () => {
  it('keeps enough to tell recipients apart in a log', () => {
    expect(maskEmail('asha@example.com')).toBe('as***@example.com');
  });

  it('does not leak a very short local part', () => {
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
  });

  it('refuses to echo something that is not an address', () => {
    expect(maskEmail('not-an-address')).toBe('***');
    expect(maskEmail('@example.com')).toBe('***');
  });
});

describe('maskSubject', () => {
  it('hides a one-time code that would otherwise be logged in full', () => {
    // The signup subject leads with the code, so logging it verbatim wrote live
    // codes into the application log at info level.
    expect(maskSubject('482913 is your Baagly verification code')).toBe(
      '****** is your Baagly verification code',
    );
  });

  it('keeps the rest of the subject readable for tracing a delivery', () => {
    expect(maskSubject('Payment pending — Lake House')).toBe(
      'Payment pending — Lake House',
    );
  });

  it('leaves short numbers alone so dates and counts still read', () => {
    expect(maskSubject('Confirmed — Lake House, Fri, 2 Oct')).toBe(
      'Confirmed — Lake House, Fri, 2 Oct',
    );
  });

  it('masks every run, not just the first', () => {
    expect(maskSubject('123456 and 7890')).toBe('****** and ****');
  });
});

describe('MailService', () => {
  beforeEach(() => {
    // The failure path logs at error level on purpose; silence it here so a
    // passing run does not look like a broken one.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends through the configured transport', async () => {
    const transport = transportThat('ok');
    const service = new MailService(transport, configOf({}));
    await service.send(message);
    expect(transport.sent).toEqual([message]);
  });

  it('throws from send() so a signup cannot report success without the code', async () => {
    const service = new MailService(transportThat('throws'), configOf({}));
    await expect(service.send(message)).rejects.toThrow(
      '535 authentication failed',
    );
  });

  it('swallows a failure in sendQuietly so a paid booking still succeeds', async () => {
    const service = new MailService(transportThat('throws'), configOf({}));
    await expect(service.sendQuietly(message)).resolves.toBe(false);
  });

  it('reports success from sendQuietly when delivery worked', async () => {
    const service = new MailService(transportThat('ok'), configOf({}));
    await expect(service.sendQuietly(message)).resolves.toBe(true);
  });

  it('logs the masked address rather than the address when delivery fails', async () => {
    const spy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const service = new MailService(transportThat('throws'), configOf({}));
    await service.sendQuietly(message);
    const logged = String(spy.mock.calls[0]?.[0] ?? '');
    expect(logged).toContain('gu***@example.com');
    expect(logged).not.toContain('guest@example.com');
  });

  it('falls back to a brand name when none is configured', () => {
    expect(new MailService(transportThat('ok'), configOf({})).brandName()).toBe(
      'Baagly',
    );
    expect(
      new MailService(
        transportThat('ok'),
        configOf({ MAIL_FROM_NAME: 'Acme' }),
      ).brandName(),
    ).toBe('Acme');
  });

  it('trims a trailing slash off the web URL so links do not double up', () => {
    const service = new MailService(
      transportThat('ok'),
      configOf({ WEB_APP_URL: 'https://baagly.com/' }),
    );
    expect(service.webUrl()).toBe('https://baagly.com');
    expect(`${service.webUrl()}/bookings/1`).toBe(
      'https://baagly.com/bookings/1',
    );
  });

  it('exposes which transport is live, so the admin panel can show it', () => {
    expect(
      new MailService(transportThat('ok'), configOf({})).providerName,
    ).toBe('fake');
  });
});
