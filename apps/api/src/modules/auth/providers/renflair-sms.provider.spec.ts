import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  RenflairSmsProvider,
  isAccepted,
  normalizeIndianMobile,
} from './renflair-sms.provider';

describe('normalizeIndianMobile', () => {
  it('accepts a bare ten-digit mobile', () => {
    expect(normalizeIndianMobile('9876543210')).toBe('9876543210');
  });

  it('strips the shapes a stored number might arrive in', () => {
    expect(normalizeIndianMobile('+919876543210')).toBe('9876543210');
    expect(normalizeIndianMobile('919876543210')).toBe('9876543210');
    expect(normalizeIndianMobile('09876543210')).toBe('9876543210');
    expect(normalizeIndianMobile('+91 98765 43210')).toBe('9876543210');
    expect(normalizeIndianMobile('98765-43210')).toBe('9876543210');
  });

  it('rejects anything that is not an Indian mobile', () => {
    expect(normalizeIndianMobile('5876543210')).toBeNull(); // must start 6-9
    expect(normalizeIndianMobile('987654321')).toBeNull(); // too short
    expect(normalizeIndianMobile('98765432101')).toBeNull(); // too long
    expect(normalizeIndianMobile('+14155550100')).toBeNull(); // US number
    expect(normalizeIndianMobile('')).toBeNull();
  });
});

describe('isAccepted', () => {
  it('accepts documented success shapes', () => {
    expect(isAccepted('{"status":"success","message":"sent"}')).toBe(true);
    expect(isAccepted('{"status":true}')).toBe(true);
    expect(isAccepted('{"status":1}')).toBe(true);
  });

  it('rejects the real failure body the live gateway returns', () => {
    // Observed from sms.renflair.in: uppercase status, served with HTTP 200.
    expect(isAccepted('{"status":"FAILED","message":"I"}')).toBe(false);
    expect(isAccepted('{"status":"SUCCESS","message":"sent"}')).toBe(true);
  });

  it('rejects explicit failures', () => {
    expect(isAccepted('{"status":"error","message":"Invalid API key"}')).toBe(false);
    expect(isAccepted('{"status":false}')).toBe(false);
    expect(isAccepted('{"status":0}')).toBe(false);
  });

  it('rejects a plain-text error even when it is not JSON', () => {
    expect(isAccepted('ERROR: insufficient credits')).toBe(false);
    expect(isAccepted('Invalid API')).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(isAccepted('')).toBe(false);
    expect(isAccepted('   ')).toBe(false);
  });

  it('accepts an unrecognised but non-error body rather than dropping a real send', () => {
    expect(isAccepted('{"status":"queued","message":"ok"}')).toBe(true);
  });
});

describe('RenflairSmsProvider', () => {
  const config = (values: Record<string, string | undefined>) =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"status":"success","message":"sent"}',
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('calls the documented endpoint with API, PHONE and OTP', async () => {
    const provider = new RenflairSmsProvider(config({ RENFLAIR_API_KEY: 'key-123' }));
    await provider.send({ phone: '+919876543210', message: 'ignored', code: '482913' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://sms.renflair.in/V1.php');
    expect(url.searchParams.get('API')).toBe('key-123');
    // Country code stripped: the gateway wants ten bare digits.
    expect(url.searchParams.get('PHONE')).toBe('9876543210');
    expect(url.searchParams.get('OTP')).toBe('482913');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET' });
  });

  it('ignores the rendered message, since the gateway supplies its own', async () => {
    const provider = new RenflairSmsProvider(config({ RENFLAIR_API_KEY: 'key-123' }));
    await provider.send({ phone: '9876543210', message: 'Your code is 111111', code: '482913' });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('OTP')).toBe('482913');
    expect(url.search).not.toContain('111111');
  });

  it('fails when the API key is missing', async () => {
    const provider = new RenflairSmsProvider(config({}));
    await expect(
      provider.send({ phone: '9876543210', message: 'x', code: '482913' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a send with no code, rather than delivering an empty template', async () => {
    const provider = new RenflairSmsProvider(config({ RENFLAIR_API_KEY: 'key-123' }));
    await expect(
      provider.send({ phone: '9876543210', message: 'some text' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a non-Indian number instead of paying for a guaranteed failure', async () => {
    const provider = new RenflairSmsProvider(config({ RENFLAIR_API_KEY: 'key-123' }));
    await expect(
      provider.send({ phone: '+14155550100', message: 'x', code: '482913' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a rejection body as a failure even on HTTP 200', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"status":"error","message":"Invalid API Key"}',
    });
    const provider = new RenflairSmsProvider(config({ RENFLAIR_API_KEY: 'bad' }));
    await expect(
      provider.send({ phone: '9876543210', message: 'x', code: '482913' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails on an HTTP error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, text: async () => 'Bad Gateway' });
    const provider = new RenflairSmsProvider(config({ RENFLAIR_API_KEY: 'key-123' }));
    await expect(
      provider.send({ phone: '9876543210', message: 'x', code: '482913' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails when the gateway times out', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted'));
    const provider = new RenflairSmsProvider(config({ RENFLAIR_API_KEY: 'key-123' }));
    await expect(
      provider.send({ phone: '9876543210', message: 'x', code: '482913' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('never puts the API key in the thrown message', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
    const provider = new RenflairSmsProvider(config({ RENFLAIR_API_KEY: 'super-secret-key' }));
    await expect(
      provider.send({ phone: '9876543210', message: 'x', code: '482913' }),
    ).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining('super-secret-key') as unknown as string,
      }),
    );
  });
});
