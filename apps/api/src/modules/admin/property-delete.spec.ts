import { AdminService } from './admin.service';
import { PropertyStatus } from '@prisma/client';

/*
  Deleting a listing is the one admin action that destroys data on purpose, so
  these tests pin the two rules that keep it safe: it cannot happen to a
  listing that is still live, and it cannot take booking history with it.
*/

type Options = {
  status?: PropertyStatus;
  bookingCount?: number;
  property?: unknown;
};

function setup(options: Options = {}) {
  const property =
    options.property === undefined
      ? {
          id: 'prop-1',
          ownerId: 'host-1',
          title: 'Riverside Cottage',
          /*
            No ?? fallback: a mistyped status would land on SUSPENDED, which is
            the one value that makes these tests pass without testing anything.
          */
          status: 'status' in options ? options.status : PropertyStatus.SUSPENDED,
          images: [
            { url: '/uploads/a.jpg' },
            { url: 'https://cdn.example.com/remote.jpg' },
          ],
          documents: [{ url: '/uploads/deed.png' }],
        }
      : options.property;

  const order: string[] = [];
  const tx = {
    property: {
      delete: jest.fn().mockImplementation(() => {
        order.push('rows');
        return Promise.resolve({});
      }),
      update: jest.fn().mockImplementation(() => {
        order.push('rows');
        return Promise.resolve({});
      }),
    },
    propertyImage: { deleteMany: jest.fn().mockResolvedValue({}) },
    propertyDocument: { deleteMany: jest.fn().mockResolvedValue({}) },
    wishlistItem: { deleteMany: jest.fn().mockResolvedValue({}) },
    availability: { deleteMany: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    property: { findUnique: jest.fn().mockResolvedValue(property) },
    booking: { count: jest.fn().mockResolvedValue(options.bookingCount ?? 0) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const media = {
    deleteStoredFiles: jest.fn().mockImplementation((urls: string[]) => {
      order.push('files');
      return Promise.resolve({ deleted: urls.length, skipped: 0, failed: [] });
    }),
  };

  /*
    Only prisma, notifications and media matter here. The collaborators in
    between are filled from the constructor's own arity so this does not go
    stale when another one is added.
  */
  const Ctor = AdminService as unknown as new (...args: unknown[]) => AdminService;
  // Everything between prisma (first) and media (last).
  const middle = Array(Math.max(0, AdminService.length - 2)).fill(undefined);
  middle[0] = notifications;
  const service = new Ctor(prisma, ...middle, media);

  return { service, prisma, tx, notifications, media, order };
}

describe('AdminService.deleteProperty', () => {
  it('refuses to delete a listing that has not been suspended', async () => {
    for (const status of [
      PropertyStatus.APPROVED,
      PropertyStatus.PENDING_APPROVAL,
      PropertyStatus.CHANGES_REQUESTED,
      PropertyStatus.DRAFT,
      PropertyStatus.REJECTED,
    ]) {
      const { service, tx, media } = setup({ status });
      await expect(service.deleteProperty('prop-1', 'admin-1')).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'CONFLICT',
          message: 'Suspend this listing before deleting it.',
        }),
      });
      expect(tx.property.delete).not.toHaveBeenCalled();
      expect(tx.property.update).not.toHaveBeenCalled();
      expect(media.deleteStoredFiles).not.toHaveBeenCalled();
    }
  });

  it('reports a listing that is not there', async () => {
    const { service } = setup({ property: null });
    await expect(service.deleteProperty('nope', 'admin-1')).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'PROPERTY_NOT_FOUND' }),
    });
  });

  it('removes the row outright when the listing was never booked', async () => {
    const { service, tx, media } = setup({ bookingCount: 0 });

    const result = await service.deleteProperty('prop-1', 'admin-1');

    expect(tx.property.delete).toHaveBeenCalledWith({ where: { id: 'prop-1' } });
    expect(tx.property.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ deleted: true, recordsKept: false, bookingCount: 0 });
    // Both stored files and the remote one are offered; MediaService decides.
    expect(media.deleteStoredFiles).toHaveBeenCalledWith([
      '/uploads/a.jpg',
      'https://cdn.example.com/remote.jpg',
      '/uploads/deed.png',
    ]);
  });

  it('keeps the row, but still frees the files, once the listing has bookings', async () => {
    const { service, tx, media } = setup({ bookingCount: 3 });

    const result = await service.deleteProperty('prop-1', 'admin-1');

    expect(tx.property.delete).not.toHaveBeenCalled();
    expect(tx.property.update).toHaveBeenCalledWith({
      where: { id: 'prop-1' },
      data: { deletedAt: expect.any(Date) },
    });
    for (const table of ['propertyImage', 'propertyDocument', 'wishlistItem', 'availability'] as const) {
      expect(tx[table].deleteMany).toHaveBeenCalledWith({ where: { propertyId: 'prop-1' } });
    }
    expect(media.deleteStoredFiles).toHaveBeenCalled();
    expect(result).toMatchObject({ deleted: true, recordsKept: true, bookingCount: 3 });
  });

  /*
    Files are not part of the transaction. Unlinking before it commits would
    leave live rows pointing at images that no longer exist if it rolled back.
  */
  it('frees the files only after the rows are committed', async () => {
    const { service, order } = setup({ bookingCount: 0 });
    await service.deleteProperty('prop-1', 'admin-1');
    expect(order).toEqual(['rows', 'files']);
  });

  it('records who deleted what', async () => {
    const { service, tx } = setup({ bookingCount: 2 });
    await service.deleteProperty('prop-1', 'admin-9');
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-9',
        action: 'PROPERTY_DELETED',
        entityType: 'Property',
        entityId: 'prop-1',
        metadata: expect.objectContaining({
          title: 'Riverside Cottage',
          ownerId: 'host-1',
          bookingCount: 2,
          recordsKept: true,
        }),
      }),
    });
  });

  it('tells the host their listing is gone', async () => {
    const { service, notifications } = setup();
    await service.deleteProperty('prop-1', 'admin-1');
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'host-1',
        // Its own type, so a host's notification history says what happened
        // rather than reporting a delete as a suspension.
        type: 'PROPERTY_DELETED',
        title: 'Property removed',
        body: 'Riverside Cottage has been removed from Baagly.',
      }),
    );
  });
});
