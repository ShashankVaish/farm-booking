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
    const service = new OwnerService(prisma as never);
    await service.properties('owner-1', 1, 20);
    await service.bookings('owner-1', 1, 20);

    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'owner-1' } }),
    );
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { property: { ownerId: 'owner-1' } },
      }),
    );
  });
});
