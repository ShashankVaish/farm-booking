import { AdminService } from './admin.service';

/*
  The per-listing reviews switch. Hiding reviews must never delete them, and
  every change is on the audit log so a hidden listing can be explained.
*/
describe('property reviews switch', () => {
  function setup(reviewsVisible: boolean | null) {
    const tx = {
      property: {
        update: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: { reviewsVisible: boolean } }) =>
              Promise.resolve({
                id: 'p1',
                reviewsVisible: data.reviewsVisible,
              }),
          ),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      review: { deleteMany: jest.fn() },
    };
    const prisma = {
      property: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            reviewsVisible === null ? null : { id: 'p1', reviewsVisible },
          ),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    // Only the Prisma client is used on this path.
    const service = Object.assign(
      Object.create(AdminService.prototype) as AdminService,
      { prisma },
    );
    return { service, tx };
  }

  it("hides a listing's reviews, audited, without deleting any", async () => {
    const { service, tx } = setup(true);
    await expect(
      service.setPropertyReviewsVisible('p1', false, 'admin-1'),
    ).resolves.toMatchObject({
      reviewsVisible: false,
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'PROPERTY_REVIEWS_HIDDEN',
        entityId: 'p1',
        actorId: 'admin-1',
      }),
    });
    expect(tx.review.deleteMany).not.toHaveBeenCalled();
  });

  it('shows them again', async () => {
    const { service, tx } = setup(false);
    await service.setPropertyReviewsVisible('p1', true, 'admin-1');
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'PROPERTY_REVIEWS_SHOWN' }),
    });
  });

  it('does nothing when the switch is already in that position', async () => {
    const { service, tx } = setup(true);
    await expect(
      service.setPropertyReviewsVisible('p1', true, 'admin-1'),
    ).resolves.toMatchObject({
      unchanged: true,
    });
    expect(tx.property.update).not.toHaveBeenCalled();
  });

  it('404s for an unknown listing', async () => {
    const { service } = setup(null);
    await expect(
      service.setPropertyReviewsVisible('nope', false, 'admin-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'PROPERTY_NOT_FOUND' }),
    });
  });
});
