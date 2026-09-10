import type { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EmailOtpService } from './email-otp.service';
import { MemoryOtpStore } from './otp/memory-otp.store';
import type { MailService } from '../mail/mail.service';

/** Pulls the six digits out of whatever the template rendered. */
function codeFrom(sent: Array<{ text: string }>): string {
  const match = /\b(\d{6})\b/.exec(sent.at(-1)?.text ?? '');
  if (!match) throw new Error('no code was sent');
  return match[1];
}

function build(
  options: { existingUser?: boolean; config?: Record<string, number> } = {},
) {
  const store = new MemoryOtpStore();
  const sent: Array<{ to: string; subject: string; text: string }> = [];

  const mail = {
    brandName: () => 'Baagly',
    webUrl: () => 'https://baagly.test',
    send: jest.fn((email: { to: string; subject: string; text: string }) => {
      sent.push(email);
      return Promise.resolve();
    }),
    sendQuietly: jest.fn().mockResolvedValue(true),
  } as unknown as MailService;

  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.existingUser ? { id: 'u1' } : null),
    },
  };

  const values: Record<string, number> = {
    OTP_TTL_SECONDS: 600,
    OTP_RESEND_COOLDOWN_SECONDS: 0,
    OTP_MAX_ATTEMPTS: 3,
    OTP_MAX_SENDS_PER_HOUR: 3,
    ...options.config,
  };
  const config = {
    get: (key: string, fallback?: unknown) =>
      key === 'OTP_PEPPER' ? 'test-pepper' : (values[key] ?? fallback),
  } as unknown as ConfigService;

  const service = new EmailOtpService(prisma as never, config, mail, store);
  return { service, store, sent, mail, prisma };
}

describe('EmailOtpService', () => {
  it('normalises the address so casing and padding cannot fork the key', () => {
    expect(EmailOtpService.normalize('  Asha@Example.COM ')).toBe(
      'asha@example.com',
    );
  });

  it('emails a code and reports when it expires', async () => {
    const { service, sent } = build();
    const result = await service.request({ email: 'asha@example.com' });

    expect(result.sent).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('asha@example.com');
    expect(codeFrom(sent)).toMatch(/^\d{6}$/);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('verifies the right code and marks the address confirmed', async () => {
    const { service, sent } = build();
    await service.request({ email: 'asha@example.com' });

    const result = await service.verify({
      email: 'asha@example.com',
      code: codeFrom(sent),
    });

    expect(result.verified).toBe(true);
    await expect(service.isVerified('asha@example.com')).resolves.toBe(true);
  });

  it('accepts the address in any casing at verify time', async () => {
    const { service, sent } = build();
    await service.request({ email: 'asha@example.com' });
    await expect(
      service.verify({ email: 'ASHA@Example.com', code: codeFrom(sent) }),
    ).resolves.toMatchObject({ verified: true });
  });

  it('rejects a wrong code without confirming anything', async () => {
    const { service, sent } = build();
    await service.request({ email: 'asha@example.com' });
    const wrong = String((Number(codeFrom(sent)) + 1) % 1000000).padStart(
      6,
      '0',
    );

    await expect(
      service.verify({ email: 'asha@example.com', code: wrong }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.isVerified('asha@example.com')).resolves.toBe(false);
  });

  it('locks the challenge after the attempt budget is spent', async () => {
    const { service, sent } = build({ config: { OTP_MAX_ATTEMPTS: 2 } });
    await service.request({ email: 'asha@example.com' });

    await expect(
      service.verify({ email: 'asha@example.com', code: '000000' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.verify({ email: 'asha@example.com', code: '000001' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // The correct code no longer works: the challenge was burned when the
    // budget ran out, so guessing cannot be resumed.
    await expect(
      service.verify({ email: 'asha@example.com', code: codeFrom(sent) }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a code that was never requested', async () => {
    const { service } = build();
    await expect(
      service.verify({ email: 'nobody@example.com', code: '123456' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('cannot verify the same code twice', async () => {
    const { service, sent } = build();
    await service.request({ email: 'asha@example.com' });
    const code = codeFrom(sent);

    await service.verify({ email: 'asha@example.com', code });
    await expect(
      service.verify({ email: 'asha@example.com', code }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('only lets one signup spend a verification', async () => {
    const { service, sent } = build();
    await service.request({ email: 'asha@example.com' });
    await service.verify({ email: 'asha@example.com', code: codeFrom(sent) });

    await expect(service.consumeVerification('asha@example.com')).resolves.toBe(
      true,
    );
    await expect(service.consumeVerification('asha@example.com')).resolves.toBe(
      false,
    );
  });

  it('expires a code once its window passes', async () => {
    jest.useFakeTimers();
    try {
      const { service, sent } = build({ config: { OTP_TTL_SECONDS: 60 } });
      await service.request({ email: 'asha@example.com' });
      const code = codeFrom(sent);

      jest.advanceTimersByTime(61_000);

      await expect(
        service.verify({ email: 'asha@example.com', code }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not reveal that an address is already registered', async () => {
    const { service, sent } = build({ existingUser: true });
    const result = await service.request({ email: 'taken@example.com' });

    // Identical shape to a real send: answering honestly here would turn signup
    // into a membership oracle. No code is issued.
    expect(result.sent).toBe(true);
    expect(result.email).toBe('taken@example.com');
    expect(sent).toHaveLength(0);
  });

  it('tells the inbox owner instead of leaving them waiting for a code', async () => {
    // Silence stranded real people on a "check your inbox" screen when the
    // code was never coming. Only the owner of the address can read this.
    const { service, mail } = build({ existingUser: true });
    await service.request({ email: 'taken@example.com' });

    const quiet = (mail.sendQuietly as jest.Mock).mock.calls;
    expect(quiet).toHaveLength(1);
    expect(quiet[0][0].to).toBe('taken@example.com');
    expect(quiet[0][0].subject).toContain('already have a');
    expect(quiet[0][0].text).toContain('/auth/login');
    // Crucially, no verification code is in it — this email reaches an
    // address whose owner did not necessarily start the signup.
    expect(quiet[0][0].text).not.toMatch(/\b\d{6}\b/);
  });

  it('keeps the response identical when the notice email fails', async () => {
    // Sent quietly on purpose: if a delivery failure changed the response or
    // threw, that difference would leak the very thing the opaque result hides.
    const { service, mail } = build({ existingUser: true });
    (mail.sendQuietly as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      service.request({ email: 'taken@example.com' }),
    ).resolves.toMatchObject({
      sent: true,
      email: 'taken@example.com',
    });
  });

  it('does not spend the send-rate budget on an existing address', async () => {
    // Otherwise anyone could exhaust a real user's quota by replaying signup.
    const { service, store } = build({ existingUser: true });
    await service.request({ email: 'taken@example.com' });
    expect(
      await store.countSends('taken@example.com', 'VERIFY_EMAIL', 3600),
    ).toBe(0);
  });

  it('holds a caller to the resend cooldown', async () => {
    const { service } = build({ config: { OTP_RESEND_COOLDOWN_SECONDS: 60 } });
    await service.request({ email: 'asha@example.com' });
    await expect(
      service.request({ email: 'asha@example.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rate limits sends across the trailing hour', async () => {
    const { service } = build({
      config: { OTP_RESEND_COOLDOWN_SECONDS: 0, OTP_MAX_SENDS_PER_HOUR: 2 },
    });
    await service.request({ email: 'asha@example.com' });
    await service.request({ email: 'asha@example.com' });
    await expect(
      service.request({ email: 'asha@example.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('invalidates the previous code when a new one is requested', async () => {
    const { service, sent } = build({
      config: { OTP_RESEND_COOLDOWN_SECONDS: 0 },
    });
    await service.request({ email: 'asha@example.com' });
    const first = codeFrom(sent);
    await service.request({ email: 'asha@example.com' });
    const second = codeFrom(sent);

    if (first !== second) {
      await expect(
        service.verify({ email: 'asha@example.com', code: first }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(
      service.verify({ email: 'asha@example.com', code: second }),
    ).resolves.toMatchObject({ verified: true });
  });

  it('keeps email codes in a separate namespace from phone codes', async () => {
    const { service, store, sent } = build();
    await service.request({ email: 'asha@example.com' });
    await service.verify({ email: 'asha@example.com', code: codeFrom(sent) });

    // The signup marker must not satisfy a phone check, and vice versa.
    await expect(
      store.isVerified('asha@example.com', 'VERIFY_PHONE'),
    ).resolves.toBe(false);
    await expect(
      store.isVerified('asha@example.com', 'VERIFY_EMAIL'),
    ).resolves.toBe(true);
  });

  it('surfaces a delivery failure instead of claiming the code was sent', async () => {
    const { service, mail } = build();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    (mail.send as jest.Mock).mockRejectedValueOnce(
      new Error('535 authentication failed'),
    );

    // A specific 503 rather than a bare 500, so the form can say the email
    // could not be sent instead of implying the address was wrong.
    await expect(
      service.request({ email: 'asha@example.com' }),
    ).rejects.toMatchObject({
      response: { errorCode: 'EMAIL_SEND_FAILED' },
    });
    jest.restoreAllMocks();
  });
});
