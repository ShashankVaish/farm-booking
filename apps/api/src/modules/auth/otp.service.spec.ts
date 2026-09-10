import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthService } from './auth.service';
import type { PasswordService } from './password.service';
import type { SmsProvider } from './providers/sms-provider.interface';
import { MemoryOtpStore } from './otp/memory-otp.store';
import { OtpService } from './otp.service';

/**
 * Exercises the OTP rules against a real store implementation, with the
 * database, SMS and session issuing faked. The store is the in-memory one,
 * which otp-store.spec proves behaves identically to Redis.
 */

const SETTINGS: Record<string, number> = {
  OTP_TTL_SECONDS: 300,
  OTP_RESEND_COOLDOWN_SECONDS: 60,
  OTP_MAX_ATTEMPTS: 3,
  OTP_MAX_SENDS_PER_HOUR: 4,
};

type SentMessage = { phone: string; message: string };

function build(options: { user?: Record<string, unknown> | null } = {}) {
  const sent: SentMessage[] = [];
  const store = new MemoryOtpStore();

  const user =
    options.user === undefined
      ? { id: 'u1', email: 'a@b.com', role: 'CUSTOMER', name: 'Aisha', isActive: true }
      : options.user;

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue(user),
      create: jest.fn().mockResolvedValue(user),
    },
  } as unknown as PrismaService;

  const config = {
    get: <T>(key: string, fallback?: T) => (SETTINGS[key] as T) ?? fallback,
  } as unknown as ConfigService;

  const auth = {
    issueSession: jest.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }),
  } as unknown as AuthService;

  const passwords = {
    hash: jest.fn().mockResolvedValue('hashed'),
  } as unknown as PasswordService;

  const sms: SmsProvider = {
    send: jest.fn(async (message: SentMessage) => {
      sent.push(message);
    }),
  } as unknown as SmsProvider;

  const service = new OtpService(prisma, config, auth, passwords, sms, store);
  return { service, store, sent, prisma, auth };
}

/** Pulls the six-digit code out of the message the fake SMS provider captured. */
function codeFrom(sent: SentMessage[]): string {
  const match = sent[sent.length - 1]?.message.match(/\b(\d{6})\b/);
  if (!match) throw new Error('No code was sent');
  return match[1];
}

const PHONE = '9812345670';

describe('OtpService — requesting a code', () => {
  it('sends a six-digit code and reports when a resend is allowed', async () => {
    const { service, sent } = build();
    const result = await service.request({ phone: PHONE }, {});

    expect(result.sent).toBe(true);
    expect(sent).toHaveLength(1);
    expect(codeFrom(sent)).toMatch(/^\d{6}$/);
    expect(new Date(result.resendAvailableAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('masks the phone number in the response', async () => {
    const { service } = build();
    const result = await service.request({ phone: PHONE }, {});
    expect(result.phone).not.toBe(PHONE);
  });

  it('refuses a second request inside the cooldown', async () => {
    const { service } = build();
    await service.request({ phone: PHONE }, {});
    await expect(service.request({ phone: PHONE }, {})).rejects.toThrow(BadRequestException);
  });

  it('rate limits once the hourly send budget is spent', async () => {
    const { service, store } = build();
    // Clear the cooldown between sends so the rate limit is what actually bites.
    for (let i = 0; i < SETTINGS.OTP_MAX_SENDS_PER_HOUR; i += 1) {
      await service.request({ phone: PHONE }, {});
      // Expire the cooldown so the send limit is what actually bites here.
      await store.startCooldown(PHONE, 'LOGIN', 0);
    }
    await expect(service.request({ phone: PHONE }, {})).rejects.toMatchObject({
      response: { errorCode: 'OTP_RATE_LIMITED' },
    });
  });

  it('does not reveal whether a phone is registered', async () => {
    const { service, sent } = build({ user: null });
    const result = await service.request({ phone: PHONE }, {});

    // Looks exactly like a successful send, but nothing was actually sent.
    expect(result.sent).toBe(true);
    expect(result.expiresAt).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it('does not reveal that a phone is already taken when registering', async () => {
    const { service, sent } = build();
    const result = await service.request({ phone: PHONE }, {}, 'REGISTER');
    expect(result.sent).toBe(true);
    expect(sent).toHaveLength(0);
  });
});

describe('OtpService — verifying a code', () => {
  it('accepts the correct code and issues a session', async () => {
    const { service, sent, auth } = build();
    await service.request({ phone: PHONE }, {});

    const result = await service.verify({ phone: PHONE, code: codeFrom(sent) }, {});

    expect(result.user.id).toBe('u1');
    expect(result.tokens.accessToken).toBe('at');
    expect(auth.issueSession).toHaveBeenCalledTimes(1);
  });

  it('rejects a wrong code', async () => {
    const { service, sent } = build();
    await service.request({ phone: PHONE }, {});
    const wrong = codeFrom(sent) === '000000' ? '111111' : '000000';

    await expect(service.verify({ phone: PHONE, code: wrong }, {})).rejects.toMatchObject({
      response: { errorCode: 'OTP_INVALID' },
    });
  });

  it('burns the code after the attempt budget is spent', async () => {
    const { service, sent } = build();
    await service.request({ phone: PHONE }, {});
    const correct = codeFrom(sent);
    const wrong = correct === '000000' ? '111111' : '000000';

    for (let i = 0; i < SETTINGS.OTP_MAX_ATTEMPTS; i += 1) {
      await expect(service.verify({ phone: PHONE, code: wrong }, {})).rejects.toThrow(
        UnauthorizedException,
      );
    }

    // Even the correct code must now fail: guessing has exhausted this challenge.
    await expect(service.verify({ phone: PHONE, code: correct }, {})).rejects.toMatchObject({
      response: { errorCode: 'OTP_INVALID' },
    });
  });

  it('allows a code to be used only once', async () => {
    const { service, sent } = build();
    await service.request({ phone: PHONE }, {});
    const code = codeFrom(sent);

    await service.verify({ phone: PHONE, code }, {});
    await expect(service.verify({ phone: PHONE, code }, {})).rejects.toMatchObject({
      response: { errorCode: 'OTP_INVALID' },
    });
  });

  it('reports an expired code distinctly', async () => {
    const { service, store, sent } = build();
    await service.request({ phone: PHONE }, {});
    const code = codeFrom(sent);

    // Rewrite the stored challenge as already past its expiry.
    const held = await store.getChallenge(PHONE, 'LOGIN');
    await store.putChallenge(
      PHONE,
      'LOGIN',
      { ...held!, expiresAt: Date.now() - 1000 },
      60,
    );

    await expect(service.verify({ phone: PHONE, code }, {})).rejects.toMatchObject({
      response: { errorCode: 'OTP_EXPIRED' },
    });
  });

  it('rejects verification when no code was ever requested', async () => {
    const { service } = build();
    await expect(service.verify({ phone: PHONE, code: '123456' }, {})).rejects.toMatchObject({
      response: { errorCode: 'OTP_INVALID' },
    });
  });

  it('will not let a LOGIN code satisfy a REGISTER challenge', async () => {
    const { service, sent } = build();
    await service.request({ phone: PHONE }, {});
    const loginCode = codeFrom(sent);

    await expect(
      service.verify({ phone: PHONE, code: loginCode, purpose: 'REGISTER', name: 'Aisha' }, {}),
    ).rejects.toMatchObject({ response: { errorCode: 'OTP_INVALID' } });
  });
});

describe('OtpService — codes for host phone verification', () => {
  it('issues and consumes a VERIFY_PHONE code without creating a session', async () => {
    const { service, sent, auth } = build();
    await service.requestForPurpose(PHONE, 'VERIFY_PHONE', {});
    expect(sent).toHaveLength(1);

    await service.consumeForPurpose(PHONE, 'VERIFY_PHONE', codeFrom(sent));
    expect(auth.issueSession).not.toHaveBeenCalled();
  });

  it('cannot be replayed against the login endpoint', async () => {
    const { service, sent } = build();
    await service.requestForPurpose(PHONE, 'VERIFY_PHONE', {});

    await expect(
      service.verify({ phone: PHONE, code: codeFrom(sent) }, {}),
    ).rejects.toMatchObject({ response: { errorCode: 'OTP_INVALID' } });
  });
});
