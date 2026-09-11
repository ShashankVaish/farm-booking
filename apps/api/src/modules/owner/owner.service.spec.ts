import { OwnerService } from './owner.service';

describe('owner isolation', () => {
  it('scopes property and booking queries to the authenticated owner id', async () => {
    const prisma = {
      property: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new OwnerService(prisma as never, audit as never);
    await service.properties('owner-1', 1, 20);
    await service.bookings('owner-1', 1, 20);

    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: 'owner-1', deletedAt: null },
      }),
    );
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { property: { ownerId: 'owner-1' } },
      }),
    );
  });
});

describe('becomeHost', () => {
  function build(user: Record<string, unknown> | null) {
    const tx = {
      user: { update: jest.fn().mockResolvedValue({ ...user, role: 'OWNER' }) },
      ownerProfile: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      // Not async: the callback is already what the service awaits, so wrapping
      // it in an async arrow adds a promise with nothing to await inside it.
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new OwnerService(prisma as never, audit as never),
      prisma,
      tx,
      audit,
    };
  }

  const customer = {
    id: 'u1',
    email: 'a@b.com',
    name: 'Asha',
    role: 'CUSTOMER',
    isActive: true,
  };

  it('upgrades a customer to a host and creates the owner profile', async () => {
    const { service, tx } = build(customer);
    const result = await service.becomeHost('u1');

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'OWNER' } }),
    );
    // The profile holds KYC and payout details; the listing wizard writes into
    // it, so it has to exist before the host reaches that step.
    expect(tx.ownerProfile.upsert).toHaveBeenCalled();
    expect(result.role).toBe('OWNER');
    expect(result.alreadyHost).toBe(false);
  });

  it('is idempotent for someone who is already a host', async () => {
    // The button can be double-tapped; a second call must not churn the record.
    const { service, tx } = build({ ...customer, role: 'OWNER' });
    const result = await service.becomeHost('u1');

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(result.alreadyHost).toBe(true);
    expect(result.role).toBe('OWNER');
  });

  it('still ensures a profile exists for a host that never had one', async () => {
    const { service, tx } = build({ ...customer, role: 'OWNER' });
    await service.becomeHost('u1');
    expect(tx.ownerProfile.upsert).toHaveBeenCalled();
  });

  it('refuses to downgrade an admin', async () => {
    // Converting an admin to OWNER would silently strip its moderation powers.
    const { service } = build({ ...customer, role: 'ADMIN' });
    await expect(service.becomeHost('u1')).rejects.toMatchObject({
      response: { errorCode: 'FORBIDDEN' },
    });
  });

  it('rejects a disabled or missing account', async () => {
    await expect(build(null).service.becomeHost('u1')).rejects.toMatchObject({
      response: { errorCode: 'NOT_FOUND' },
    });
    await expect(
      build({ ...customer, isActive: false }).service.becomeHost('u1'),
    ).rejects.toMatchObject({ response: { errorCode: 'NOT_FOUND' } });
  });

  it('records the upgrade in the audit trail', async () => {
    const { service, audit } = build(customer);
    await service.becomeHost('u1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HOST_ACCOUNT_ENABLED',
        metadata: { previousRole: 'CUSTOMER' },
      }),
    );
  });
});
