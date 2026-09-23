import { AgreementsService } from './agreements.service';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';

const host: RequestUser = {
  id: 'host-1',
  email: 'h@example.com',
  role: UserRoles.OWNER,
  name: 'Asha Host',
};
const other: RequestUser = { ...host, id: 'host-2', email: 'o@example.com' };

const v2 = {
  id: 'agr-2',
  version: 2,
  title: 'Host Agreement',
  body: 'the current text',
  isActive: true,
  createdAt: new Date('2026-09-01'),
};

function build(
  options: {
    active?: typeof v2 | null;
    existingAcceptance?: object | null;
    property?: { id: string; ownerId: string; deletedAt: Date | null } | null;
  } = {},
) {
  const prisma = {
    hostAgreement: {
      findFirst: jest
        .fn()
        .mockResolvedValue('active' in options ? options.active : v2),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    hostAgreementAcceptance: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.existingAcceptance ?? null),
      findUnique: jest
        .fn()
        .mockResolvedValue(options.existingAcceptance ?? null),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'acc-1', ...data, acceptedAt: new Date() }),
        ),
    },
    property: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'property' in options
            ? options.property
            : { id: 'p1', ownerId: host.id, deletedAt: null },
        ),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new AgreementsService(
      prisma as never,
      audit as never,
      { get: () => undefined } as never,
    ),
    prisma,
    audit,
  };
}

describe('signing', () => {
  it('records the typed name, version, property and where it came from', async () => {
    const { service, prisma, audit } = build();
    const result = await service.sign(
      host,
      { propertyId: 'p1', signatureName: '  Asha   Host ' },
      { ipAddress: '1.2.3.4', userAgent: 'Mozilla/5.0' },
    );
    expect(result.alreadySigned).toBe(false);
    expect(prisma.hostAgreementAcceptance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agreementId: 'agr-2',
          userId: host.id,
          propertyId: 'p1',
          // Whitespace is normalised; the name is otherwise kept as typed.
          signatureName: 'Asha Host',
          ipAddress: '1.2.3.4',
          userAgent: 'Mozilla/5.0',
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HOST_AGREEMENT_SIGNED',
        metadata: expect.objectContaining({ agreementVersion: 2 }),
      }),
    );
  });

  it('only the listing’s owner can sign for it', async () => {
    const { service, prisma } = build();
    await expect(
      service.sign(
        other,
        { propertyId: 'p1', signatureName: 'Other Person' },
        {},
      ),
    ).rejects.toMatchObject({ response: { errorCode: 'FORBIDDEN' } });
    expect(prisma.hostAgreementAcceptance.create).not.toHaveBeenCalled();
  });

  it('rejects a signature that is not a name', async () => {
    const { service } = build();
    await expect(
      service.sign(host, { propertyId: 'p1', signatureName: ' x ' }, {}),
    ).rejects.toMatchObject({ response: { errorCode: 'VALIDATION_ERROR' } });
  });

  it('is idempotent: a second signature returns the first', async () => {
    const first = { id: 'acc-0', signatureName: 'Asha Host' };
    const { service, prisma } = build({ existingAcceptance: first });
    const result = await service.sign(
      host,
      { propertyId: 'p1', signatureName: 'Asha Host' },
      {},
    );
    expect(result.alreadySigned).toBe(true);
    expect(result.acceptance).toEqual(first);
    expect(prisma.hostAgreementAcceptance.create).not.toHaveBeenCalled();
  });

  it('cannot sign for a deleted listing', async () => {
    const { service } = build({
      property: { id: 'p1', ownerId: host.id, deletedAt: new Date() },
    });
    await expect(
      service.sign(host, { propertyId: 'p1', signatureName: 'Asha Host' }, {}),
    ).rejects.toMatchObject({ response: { errorCode: 'PROPERTY_NOT_FOUND' } });
  });
});

describe('the submission gate', () => {
  it('passes when the current version is signed for this listing', async () => {
    const { service, prisma } = build({ existingAcceptance: { id: 'acc-1' } });
    await expect(
      service.assertSignedForSubmission(host.id, 'p1'),
    ).resolves.toBeUndefined();
    expect(prisma.hostAgreementAcceptance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agreementId: 'agr-2', propertyId: 'p1', userId: host.id },
      }),
    );
  });

  it('fails, naming the version, when nothing is signed', async () => {
    const { service } = build();
    await expect(
      service.assertSignedForSubmission(host.id, 'p1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'AGREEMENT_REQUIRED',
        message: expect.stringContaining('version 2'),
      }),
    });
  });

  it('fails when the admin has published a newer version since the host signed', async () => {
    /*
      The check is by agreement id, so an acceptance of version 1 is simply not
      found once version 2 is active. Nobody is bound by text they never saw.
    */
    const { service, prisma } = build();
    prisma.hostAgreementAcceptance.findFirst.mockResolvedValue(null); // v1 row ≠ v2 id
    await expect(
      service.assertSignedForSubmission(host.id, 'p1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'AGREEMENT_REQUIRED' }),
    });
  });
});

describe('publishing (admin only path)', () => {
  it('creates the next version and retires the current one, atomically', async () => {
    const { service, prisma, audit } = build();
    prisma.hostAgreement.findFirst.mockResolvedValue({
      version: 2,
      title: 'Host Agreement',
      body: 'old',
    });
    prisma.hostAgreement.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'agr-3', ...data }),
    );
    const result = await service.publish('admin-1', {
      title: 'Host Agreement',
      body: 'new text '.repeat(10),
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.hostAgreement.updateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    });
    expect(result).toMatchObject({
      version: 3,
      isActive: true,
      createdById: 'admin-1',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'HOST_AGREEMENT_PUBLISHED' }),
    );
  });

  it('refuses to publish an unchanged text', async () => {
    // A no-op version would force every host to sign again for nothing.
    const { service, prisma } = build();
    prisma.hostAgreement.findFirst.mockResolvedValue({
      version: 2,
      title: 'Host Agreement',
      body: 'same',
    });
    await expect(
      service.publish('admin-1', { title: 'Host Agreement', body: 'same' }),
    ).rejects.toMatchObject({ response: { errorCode: 'VALIDATION_ERROR' } });
    expect(prisma.hostAgreement.create).not.toHaveBeenCalled();
  });

  it('normalises Windows line endings so the stored text is what is shown', async () => {
    const { service, prisma } = build();
    prisma.hostAgreement.findFirst.mockResolvedValue(null);
    prisma.hostAgreement.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'agr-1', ...data }),
    );
    const result = await service.publish('admin-1', {
      title: 'T',
      body: 'line one\r\nline two\r\n' + 'x'.repeat(60),
    });
    expect(result.body).not.toContain('\r');
  });
});

describe('what the admin review page sees', () => {
  it('flags a signature against an older version as not current', async () => {
    const { service, prisma } = build();
    prisma.hostAgreementAcceptance.findFirst.mockResolvedValue({
      id: 'acc-old',
      signatureName: 'Asha Host',
      acceptedAt: new Date('2026-08-01'),
      agreement: { id: 'agr-1', version: 1, title: 'Host Agreement' },
    });
    const view = await service.acceptanceForProperty('p1');
    expect(view.current).toBe(false);
    expect(view.activeVersion).toBe(2);
    expect(view.acceptance?.signatureName).toBe('Asha Host');
  });
});
