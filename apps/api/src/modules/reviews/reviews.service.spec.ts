import { ReviewsService } from './reviews.service';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';

describe('review authorization', () => {
  const customer: RequestUser = {
    id: 'cust-1',
    email: 'c@example.com',
    role: UserRoles.CUSTOMER,
    name: 'C',
  };

  it('rejects reviews without a completed booking on the same property', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'b1',
          propertyId: 'other',
          customerId: 'cust-1',
          status: 'COMPLETED',
        }),
      },
    };
    const service = new ReviewsService(prisma as never);
    await expect(
      service.create('prop-1', customer, { bookingId: 'b1', rating: 5 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'REVIEW_NOT_ALLOWED' }),
    });
  });

  it('rejects another customer reviewing someone else stay', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'b1',
          propertyId: 'prop-1',
          customerId: 'someone-else',
          status: 'COMPLETED',
        }),
      },
    };
    const service = new ReviewsService(prisma as never);
    await expect(
      service.create('prop-1', customer, { bookingId: 'b1', rating: 5 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'FORBIDDEN' }),
    });
  });

  it('rejects a review when the stay is not completed', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'b1',
          propertyId: 'prop-1',
          customerId: 'cust-1',
          status: 'CONFIRMED',
        }),
      },
    };
    const service = new ReviewsService(prisma as never);
    await expect(
      service.create('prop-1', customer, { bookingId: 'b1', rating: 5 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'REVIEW_NOT_ALLOWED' }),
    });
  });
});
