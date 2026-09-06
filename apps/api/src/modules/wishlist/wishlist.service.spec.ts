import { Prisma } from '@prisma/client';
import { WishlistService } from './wishlist.service';

describe('wishlist uniqueness', () => {
  it('maps a unique constraint failure to a conflict', async () => {
    const prisma = {
      property: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          status: 'APPROVED',
        }),
      },
      wishlistItem: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique', {
            code: 'P2002',
            clientVersion: '6.0.0',
          }),
        ),
      },
    };
    const service = new WishlistService(prisma as never);
    await expect(service.add('u1', 'p1')).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'CONFLICT' }),
    });
  });

  it('rejects wishlist add for a missing property', async () => {
    const prisma = {
      property: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new WishlistService(prisma as never);
    await expect(service.add('u1', 'missing')).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'PROPERTY_NOT_FOUND' }),
    });
  });
});
