import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpService } from './otp.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

describe('OtpService', () => {
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    otpChallenge: {
      count: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const values: Record<string, unknown> = {
        OTP_TTL_SECONDS: 300,
        OTP_RESEND_COOLDOWN_SECONDS: 60,
        OTP_MAX_ATTEMPTS: 5,
        OTP_MAX_SENDS_PER_HOUR: 5,
        OTP_PEPPER: 'pepper-pepper-pepper-pepper-pepper',
      };
      return values[key] ?? fallback;
    }),
  } as unknown as ConfigService;
  const auth = { issueSession: jest.fn() } as unknown as AuthService;
  const passwords = { hash: jest.fn() } as unknown as PasswordService;
  const sms = { name: 'console', send: jest.fn().mockResolvedValue(undefined) };

  const service = new OtpService(prisma as never, config, auth, passwords, sms);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.otpChallenge.count.mockResolvedValue(0);
    prisma.otpChallenge.findFirst.mockResolvedValue(null);
    prisma.otpChallenge.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpChallenge.create.mockResolvedValue({});
    sms.send.mockResolvedValue(undefined);
  });

  it('requests an OTP for an existing login user without logging the code', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true });
    const result = await service.request(
      { phone: '9876543210', purpose: 'LOGIN' },
      {},
    );
    expect(result.sent).toBe(true);
    expect(result.phone).toBe('******3210');
    expect(sms.send).toHaveBeenCalled();
    const message = sms.send.mock.calls[0][0].message as string;
    expect(message).toMatch(/\d{6}/);
    expect(JSON.stringify(result)).not.toMatch(/\b\d{6}\b/);
  });

  it('rejects a login OTP request when no account exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.request({ phone: '9876543210', purpose: 'LOGIN' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('enforces resend cooldown', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true });
    prisma.otpChallenge.findFirst.mockResolvedValue({
      lastSentAt: new Date(),
      consumedAt: null,
    });
    await expect(
      service.request({ phone: '9876543210', purpose: 'LOGIN' }, {}),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'OTP_COOLDOWN' }),
    });
  });

  it('invalidates OTP after too many attempts', async () => {
    prisma.otpChallenge.findFirst.mockResolvedValue({
      id: 'otp-1',
      expiresAt: new Date(Date.now() + 60000),
      attemptCount: 5,
      codeHash: 'x',
      consumedAt: null,
    });
    await expect(
      service.verify(
        { phone: '9876543210', code: '123456', purpose: 'LOGIN' },
        {},
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'OTP_LOCKED' }),
    });
    expect(prisma.otpChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
  });
});
