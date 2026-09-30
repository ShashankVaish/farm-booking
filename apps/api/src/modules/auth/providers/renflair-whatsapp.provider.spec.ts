import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OtpChannelRouter } from './otp-channel.router';
import { RenflairWhatsAppOtpProvider } from './renflair-whatsapp.provider';
import type { SmsProvider } from './sms-provider.interface';

function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('RenflairWhatsAppOtpProvider', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('calls the WhatsApp V1 endpoint with key, 10-digit phone, code and country', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response('{"status":"SUCCESS","message":"sent"}', { status: 200 }),
      );
    global.fetch = fetchMock;
    const provider = new RenflairWhatsAppOtpProvider(
      configWith({ RENFLAIR_WHATSAPP_API_KEY: 'test-key' }),
    );

    await expect(
      provider.send({
        phone: '+919876543210',
        message: 'ignored',
        code: '123456',
      }),
    ).resolves.toEqual({ channel: 'whatsapp' });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe(
      'https://whatsapp.renflair.in/V1.php',
    );
    expect(url.searchParams.get('API')).toBe('test-key');
    expect(url.searchParams.get('PHONE')).toBe('9876543210');
    expect(url.searchParams.get('OTP')).toBe('123456');
    expect(url.searchParams.get('COUNTRY')).toBe('91');
  });

  it('treats the gateway FAILED body (sent with HTTP 200) as a failure', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('{"message":"NO PHONE NUMBER FOUND","status":"FAILED"}', {
        status: 200,
      }),
    );
    const provider = new RenflairWhatsAppOtpProvider(
      configWith({ RENFLAIR_WHATSAPP_API_KEY: 'test-key' }),
    );
    await expect(
      provider.send({ phone: '9876543210', message: '', code: '123456' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('is not configured without its own key', () => {
    const provider = new RenflairWhatsAppOtpProvider(
      configWith({ RENFLAIR_API_KEY: 'sms-only' }),
    );
    expect(provider.isConfigured()).toBe(false);
  });
});

describe('OtpChannelRouter', () => {
  function fake(
    name: string,
    fails = false,
  ): SmsProvider & { send: jest.Mock } {
    return {
      name,
      send: jest.fn(
        fails
          ? () => Promise.reject(new Error('down'))
          : () => Promise.resolve(),
      ),
    };
  }
  const input = { phone: '9876543210', message: 'm', code: '123456' };

  it('sends on WhatsApp by default', async () => {
    const whatsapp = fake('wa');
    const sms = fake('sms');
    await expect(
      new OtpChannelRouter(whatsapp, sms).send(input),
    ).resolves.toEqual({ channel: 'whatsapp' });
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('falls back to SMS with the same code when WhatsApp fails', async () => {
    const whatsapp = fake('wa', true);
    const sms = fake('sms');
    await expect(
      new OtpChannelRouter(whatsapp, sms).send(input),
    ).resolves.toEqual({ channel: 'sms' });
    expect(sms.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: '123456' }),
    );
  });

  it('goes straight to SMS when the person asks for SMS', async () => {
    const whatsapp = fake('wa');
    const sms = fake('sms');
    await new OtpChannelRouter(whatsapp, sms).send({
      ...input,
      channel: 'sms',
    });
    expect(whatsapp.send).not.toHaveBeenCalled();
    expect(sms.send).toHaveBeenCalled();
  });

  it('reports a failure only when both channels fail', async () => {
    await expect(
      new OtpChannelRouter(fake('wa', true), fake('sms', true)).send(input),
    ).rejects.toThrow('down');
  });
});
