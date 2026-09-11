import { AdminService } from './admin.service';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
} from '../properties/dto/property.dto';

/*
  The "Trusted property" badge is a claim the platform makes about a listing on
  a guest's behalf. A host who could set it would be vouching for themselves,
  which is worth nothing to the guest reading it — so these tests cover both
  halves of that: the admin path works, and there is no host path at all.
*/
describe('trusted property badge', () => {
  const approved = {
    id: 'p1',
    ownerId: 'owner-1',
    title: 'Lake House',
    status: 'APPROVED',
    isTrusted: false,
  };

  function setup(property: Record<string, unknown> | null = approved) {
    const tx = {
      property: {
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({ ...property, ...data }),
          ),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      property: { findUnique: jest.fn().mockResolvedValue(property) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    /*
      AdminService takes eleven collaborators; this path uses only the first
      two. The rest are filled positionally rather than named, because naming
      nine unused stubs would obscure which two actually matter here — and
      TypeScript still checks the arity, so a reordered constructor breaks the
      build rather than silently passing the wrong object.
    */
    const unused = Array(9).fill(undefined) as never[];
    const service = new AdminService(
      prisma as never,
      notifications as never,
      ...(unused as [
        never,
        never,
        never,
        never,
        never,
        never,
        never,
        never,
        never,
      ]),
    );
    return { service, prisma, tx, notifications };
  }

  it('grants the badge and stamps when it happened', async () => {
    const { service, tx } = setup();
    const result = await service.setPropertyTrusted('p1', true, 'admin-1');

    expect(result.isTrusted).toBe(true);
    const data = tx.property.update.mock.calls[0][0].data;
    expect(data.isTrusted).toBe(true);
    expect(data.trustedAt).toBeInstanceOf(Date);
  });

  it('clears the timestamp when the badge is removed', async () => {
    // "Never trusted" and "trusted at some point" must not look the same.
    const { service, tx } = setup({ ...approved, isTrusted: true });
    await service.setPropertyTrusted('p1', false, 'admin-1');

    const data = tx.property.update.mock.calls[0][0].data;
    expect(data.isTrusted).toBe(false);
    expect(data.trustedAt).toBeNull();
  });

  it('records who changed it', async () => {
    const { service, tx } = setup();
    await service.setPropertyTrusted('p1', true, 'admin-7');
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'admin-7',
          action: 'PROPERTY_TRUSTED',
          entityId: 'p1',
        }),
      }),
    );
  });

  it('tells the host their listing was trusted', async () => {
    const { service, notifications } = setup();
    await service.setPropertyTrusted('p1', true, 'admin-1');
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'owner-1', type: 'PROPERTY_TRUSTED' }),
    );
  });

  it('refuses to badge a listing guests cannot book', async () => {
    // A badge on a draft would survive quietly if it were later approved
    // without a second look.
    const { service } = setup({ ...approved, status: 'PENDING_APPROVAL' });
    await expect(
      service.setPropertyTrusted('p1', true, 'admin-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'VALIDATION_ERROR' }),
    });
  });

  it('still allows the badge to be removed from a suspended listing', async () => {
    const { service, tx } = setup({
      ...approved,
      status: 'SUSPENDED',
      isTrusted: true,
    });
    await expect(
      service.setPropertyTrusted('p1', false, 'admin-1'),
    ).resolves.toBeDefined();
    expect(tx.property.update).toHaveBeenCalled();
  });

  it('is a no-op when the badge is already in the requested state', async () => {
    const { service, tx } = setup({ ...approved, isTrusted: true });
    const result = await service.setPropertyTrusted('p1', true, 'admin-1');
    expect(result.unchanged).toBe(true);
    expect(tx.property.update).not.toHaveBeenCalled();
  });

  it('404s on a listing that does not exist', async () => {
    const { service } = setup(null);
    await expect(
      service.setPropertyTrusted('nope', true, 'admin-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'PROPERTY_NOT_FOUND' }),
    });
  });

  it('exposes no host-writable field for the badge', () => {
    /*
      The global pipe runs with whitelist + forbidNonWhitelisted, so a property
      that is absent from these DTOs is rejected outright rather than quietly
      dropped. This asserts the absence, which is the actual security boundary —
      adding `isTrusted` to either DTO would hand hosts the badge.
    */
    for (const Dto of [CreatePropertyDto, UpdatePropertyDto]) {
      const fields = Object.getOwnPropertyNames(new Dto());
      expect(fields).not.toContain('isTrusted');
      expect(fields).not.toContain('trustedAt');
    }
  });
});
