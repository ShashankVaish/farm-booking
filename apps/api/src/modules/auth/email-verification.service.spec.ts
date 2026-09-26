import { ConflictException } from '@nestjs/common';
import {
  EmailVerificationService,
  isPlaceholderEmail,
  needsEmailVerification,
} from './email-verification.service';

function build(takenBy: { id: string } | null = null) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(takenBy),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const emailOtp = {
    sendCode: jest.fn().mockResolvedValue({ sent: true }),
    checkCode: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn() };
  const service = new EmailVerificationService(
    prisma as never,
    emailOtp as never,
    audit as never,
  );
  return { service, prisma, emailOtp, audit };
}

describe('EmailVerificationService', () => {
  it('sends the code under its own purpose, never the signup one', async () => {
    const { service, emailOtp } = build();
    await service.request('u1', '  Asha@Example.com ');
    expect(emailOtp.sendCode).toHaveBeenCalledWith(
      'asha@example.com',
      'ACCOUNT_EMAIL',
    );
  });

  it('saves the address as verified once the code matches', async () => {
    const { service, prisma, emailOtp } = build();
    await expect(
      service.verify('u1', 'asha@example.com', '123456'),
    ).resolves.toEqual({ email: 'asha@example.com', emailVerified: true });
    expect(emailOtp.checkCode).toHaveBeenCalledWith(
      'asha@example.com',
      '123456',
      'ACCOUNT_EMAIL',
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { email: 'asha@example.com', emailVerifiedAt: expect.any(Date) },
    });
  });

  it('does not save anything when the code is wrong', async () => {
    const { service, prisma, emailOtp } = build();
    emailOtp.checkCode.mockRejectedValue(new Error('OTP_INVALID'));
    await expect(
      service.verify('u1', 'asha@example.com', '000000'),
    ).rejects.toThrow('OTP_INVALID');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses an address that belongs to another account', async () => {
    const { service, emailOtp } = build({ id: 'someone-else' });
    await expect(
      service.request('u1', 'taken@example.com'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(emailOtp.sendCode).not.toHaveBeenCalled();
  });

  it('refuses a placeholder address', async () => {
    const { service } = build();
    await expect(
      service.request('u1', 'phone-9876543210@otp.local'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('who must confirm an email before booking', () => {
  it('is a phone sign-up that still has the placeholder address', () => {
    expect(isPlaceholderEmail('phone-9876543210@otp.local')).toBe(true);
    expect(
      needsEmailVerification({
        email: 'phone-9876543210@otp.local',
        emailVerifiedAt: null,
      }),
    ).toBe(true);
  });

  it('is not an account with a real address', () => {
    expect(
      needsEmailVerification({
        email: 'asha@example.com',
        emailVerifiedAt: null,
      }),
    ).toBe(false);
    expect(
      needsEmailVerification({
        email: 'asha@example.com',
        emailVerifiedAt: new Date(),
      }),
    ).toBe(false);
  });
});
