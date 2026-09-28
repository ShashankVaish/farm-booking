import { HostKycService } from './host-kyc.service';

function build(options: {
  kycRequired: boolean;
  kycStatus: string;
  phoneVerified?: boolean;
}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        phone: '9876543210',
        phoneVerifiedAt: options.phoneVerified === false ? null : new Date(),
        ownerProfile: { kycStatus: options.kycStatus },
      }),
    },
  };
  const settings = { hostKycRequired: () => options.kycRequired };
  return new HostKycService(
    prisma as never,
    {} as never,
    { get: jest.fn() } as never,
    { record: jest.fn() } as never,
    settings as never,
  );
}

describe('HostKycService.status — the admin setting for identity documents', () => {
  it('blocks submission without Aadhaar and PAN when the admin requires them', async () => {
    const status = await build({
      kycRequired: true,
      kycStatus: 'NOT_SUBMITTED',
    }).status('u1');
    expect(status.documentsRequired).toBe(true);
    expect(status.canSubmitListing).toBe(false);
  });

  it('allows submission without them when the admin makes them optional', async () => {
    const status = await build({
      kycRequired: false,
      kycStatus: 'NOT_SUBMITTED',
    }).status('u1');
    expect(status.documentsRequired).toBe(false);
    expect(status.canSubmitListing).toBe(true);
  });

  it('still requires a verified mobile either way', async () => {
    const status = await build({
      kycRequired: false,
      kycStatus: 'NOT_SUBMITTED',
      phoneVerified: false,
    }).status('u1');
    expect(status.canSubmitListing).toBe(false);
  });

  it('allows submission once documents are in, when required', async () => {
    const status = await build({
      kycRequired: true,
      kycStatus: 'SUBMITTED',
    }).status('u1');
    expect(status.canSubmitListing).toBe(true);
  });
});
