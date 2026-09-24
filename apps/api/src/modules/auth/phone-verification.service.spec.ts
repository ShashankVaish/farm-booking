import { ConflictException } from '@nestjs/common';
import { PhoneVerificationService } from './phone-verification.service';

function build(takenBy: { id: string } | null = null) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(takenBy),
      update: jest.fn().mockResolvedValue({}),
    },
    notificationPreference: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const otp = {
    requestForPurpose: jest.fn().mockResolvedValue({ sent: true }),
    consumeForPurpose: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn() };
  const service = new PhoneVerificationService(
    prisma as never,
    otp as never,
    audit as never,
  );
  return { service, prisma, otp, audit };
}

describe('PhoneVerificationService', () => {
  it('sends the code with the VERIFY_PHONE purpose, never the login one', async () => {
    const { service, otp } = build();
    await service.request(
      'u1',
      { phone: '9876543210' },
      { ipAddress: '1.2.3.4' },
    );
    expect(otp.requestForPurpose).toHaveBeenCalledWith(
      '9876543210',
      'VERIFY_PHONE',
      {
        ipAddress: '1.2.3.4',
      },
    );
  });

  it('marks the phone verified and records the WhatsApp opt-in', async () => {
    const { service, prisma, otp } = build();
    await expect(
      service.verify('u1', {
        phone: '9876543210',
        code: '123456',
        whatsappOptIn: true,
      }),
    ).resolves.toEqual({ phone: '9876543210', phoneVerified: true });
    expect(otp.consumeForPurpose).toHaveBeenCalledWith(
      '9876543210',
      'VERIFY_PHONE',
      '123456',
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { phone: '9876543210', phoneVerifiedAt: expect.any(Date) },
    });
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1', whatsapp: true },
      update: { whatsapp: true },
    });
  });

  it('leaves the WhatsApp choice alone when none was made', async () => {
    const { service, prisma } = build();
    await service.verify('u1', { phone: '9876543210', code: '123456' });
    expect(prisma.notificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('refuses a number that belongs to another account', async () => {
    const { service, otp, prisma } = build({ id: 'someone-else' });
    await expect(
      service.request('u1', { phone: '9876543210' }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.verify('u1', { phone: '9876543210', code: '123456' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(otp.requestForPurpose).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not mark anything verified when the code is wrong', async () => {
    const { service, otp, prisma } = build();
    otp.consumeForPurpose.mockRejectedValue(new Error('OTP_INVALID'));
    await expect(
      service.verify('u1', { phone: '9876543210', code: '000000' }),
    ).rejects.toThrow('OTP_INVALID');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
