import { NotFoundException } from '@nestjs/common';
import { UserRoles } from '../../common/constants/roles';
import { PropertiesService } from './properties.service';
import { canManageProperty } from './property-status';
import type { RequestUser } from '../auth/auth.types';

/** The service only uses mail to alert admins; nothing under test sends. */
function mailStub() {
  return {
    adminAddress: jest.fn().mockReturnValue('ops@example.com'),
    webUrl: jest.fn().mockReturnValue('https://example.test'),
    brandName: jest.fn().mockReturnValue('Baagly'),
    sendQuietly: jest.fn().mockResolvedValue(true),
  };
}

describe('property ownership authorization', () => {
  const owner: RequestUser = {
    id: 'owner-1',
    email: 'owner@example.com',
    role: UserRoles.OWNER,
    name: 'Owner',
  };
  const otherOwner: RequestUser = {
    id: 'owner-2',
    email: 'other@example.com',
    role: UserRoles.OWNER,
    name: 'Other',
  };
  const admin: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRoles.ADMIN,
    name: 'Admin',
  };
  const customer: RequestUser = {
    id: 'cust-1',
    email: 'c@example.com',
    role: UserRoles.CUSTOMER,
    name: 'Customer',
  };

  it('allows the owning user and admin only', () => {
    expect(canManageProperty('owner-1', owner)).toBe(true);
    expect(canManageProperty('owner-1', admin)).toBe(true);
    expect(canManageProperty('owner-1', otherOwner)).toBe(false);
    expect(canManageProperty('owner-1', customer)).toBe(false);
  });

  it('hides non-approved properties from customers', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const prisma = {
      property: {
        findUnique: jest.fn().mockResolvedValue({
          id,
          ownerId: 'owner-1',
          status: 'DRAFT',
          deletedAt: null,
        }),
      },
    };
    const service = new PropertiesService(prisma as never, mailStub() as never);
    await expect(service.getById(id, customer)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.getById(id, owner)).resolves.toBeDefined();
  });

  it('loads an approved listing by slug', async () => {
    const listing = {
      id: 'p1',
      slug: 'courtyard-lonavala',
      ownerId: 'owner-1',
      status: 'APPROVED',
      deletedAt: null,
    };
    const prisma = {
      property: {
        findUnique: jest.fn().mockResolvedValue(listing),
      },
    };
    const service = new PropertiesService(prisma as never, mailStub() as never);
    await expect(
      service.getById('courtyard-lonavala', customer),
    ).resolves.toMatchObject({ slug: 'courtyard-lonavala' });
    expect(prisma.property.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.property.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'courtyard-lonavala' } }),
    );
  });

  it('rejects invalid map coordinates on create', async () => {
    const service = new PropertiesService({} as never, mailStub() as never);
    await expect(
      service.create(owner, {
        title: 'Farm',
        description: 'A very long description for the listing.',
        propertyType: 'FARMHOUSE',
        location: 'Pune',
        city: 'Pune',
        state: 'Maharashtra',
        address: 'Koregaon Park',
        pincode: '411001',
        latitude: 0,
        longitude: 0,
        guestCapacity: 8,
        bedrooms: 3,
        bathrooms: 2,
        basePrice: 10000,
      } as never),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'INVALID_COORDINATES' }),
    });
  });
});

describe('submitting a listing for review', () => {
  const owner: RequestUser = {
    id: 'owner-1',
    email: 'owner@example.com',
    role: UserRoles.OWNER,
    name: 'Owner',
  };

  function setup(currentStatus = 'DRAFT', photoCount = 1) {
    const saved = { id: 'p1', status: 'PENDING_APPROVAL' };
    const tx = {
      propertyAmenity: { deleteMany: jest.fn(), createMany: jest.fn() },
      propertyImage: { deleteMany: jest.fn(), createMany: jest.fn() },
      property: { update: jest.fn().mockResolvedValue(saved) },
    };
    const prisma = {
      property: {
        findUnique: jest
          .fn()
          // requireManaged reads the property first, then notifyAdmin reads it
          // again for the mail body.
          .mockResolvedValueOnce({
            id: 'p1',
            ownerId: owner.id,
            status: currentStatus,
            deletedAt: null,
            latitude: 18.5,
            longitude: 73.8,
          })
          .mockResolvedValue({
            id: 'p1',
            title: 'Lake House',
            city: 'Lonavala',
            state: 'Maharashtra',
            location: 'Lonavala',
            updatedAt: new Date('2026-09-11T00:00:00Z'),
            owner: { name: 'Asha Host', email: 'asha@example.com' },
          }),
      },
      propertyImage: { count: jest.fn().mockResolvedValue(photoCount) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          phoneVerifiedAt: new Date(),
          ownerProfile: { kycStatus: 'VERIFIED' },
        }),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const mail = mailStub();
    return {
      service: new PropertiesService(prisma as never, mail as never),
      mail,
      prisma,
    };
  }

  const submit = { status: 'PENDING_APPROVAL' } as never;

  it('accepts a submission with fewer than four photos', async () => {
    /*
      The four-photo minimum was removed from the wizard but survived here, so
      a host could complete every step and then be refused by a rule no screen
      had mentioned.
    */
    const { service } = setup('DRAFT', 1);
    await expect(service.update('p1', owner, submit)).resolves.toBeDefined();
  });

  it('still refuses more photos than the cap', async () => {
    const { service } = setup('DRAFT', 99);
    await expect(service.update('p1', owner, submit)).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'VALIDATION_ERROR' }),
    });
  });

  it('emails the admin inbox when a listing enters the queue', async () => {
    const { service, mail } = setup('DRAFT');
    await service.update('p1', owner, submit);

    expect(mail.sendQuietly).toHaveBeenCalledTimes(1);
    const sent = mail.sendQuietly.mock.calls[0][0];
    expect(sent.to).toBe('ops@example.com');
    expect(sent.subject).toContain('Lake House');
    // An admin triaging on a phone needs the host and the place in the body.
    expect(sent.text).toContain('asha@example.com');
    expect(sent.text).toContain('Lonavala');
  });

  it('does not email again when an already-pending listing is edited', async () => {
    // Saving the same listing twice must not spam the queue.
    const { service, mail } = setup('PENDING_APPROVAL');
    await service.update('p1', owner, submit);
    expect(mail.sendQuietly).not.toHaveBeenCalled();
  });

  it('does not email for an ordinary edit that leaves the status alone', async () => {
    const { service, mail } = setup('DRAFT');
    await service.update('p1', owner, { title: 'New name' });
    expect(mail.sendQuietly).not.toHaveBeenCalled();
  });

  it('saves the listing even when the mail server is down', async () => {
    /*
      The email is a prompt, not the record: the listing is in the admin queue
      either way, so a dead SMTP host must not fail the host's submission.
    */
    const { service, mail } = setup('DRAFT');
    mail.sendQuietly.mockRejectedValue(new Error('SMTP unreachable'));
    await expect(service.update('p1', owner, submit)).resolves.toBeDefined();
  });

  it('skips the email when no admin address is configured', async () => {
    const { service, mail } = setup('DRAFT');
    mail.adminAddress.mockReturnValue(null);
    await service.update('p1', owner, submit);
    expect(mail.sendQuietly).not.toHaveBeenCalled();
  });
});
