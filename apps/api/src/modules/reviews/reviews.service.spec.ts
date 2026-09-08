import { ReviewsService } from './reviews.service';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';

const notifications = {
  notify: jest.fn().mockResolvedValue({ created: true }),
} as unknown as NotificationsService;

describe('review authorization', () => {
  const customer: RequestUser = {
    id: 'cust-1',
    email: 'c@example.com',
    role: UserRoles.CUSTOMER,
    name: 'C',
  };

  function booking(overrides: Record<string, unknown> = {}) {
    return {
      id: 'b1',
      propertyId: 'prop-1',
      customerId: 'cust-1',
      status: 'COMPLETED',
      property: { id: 'prop-1', ownerId: 'owner-1', title: 'Farm' },
      ...overrides,
    };
  }

  it('rejects reviews without a completed booking on the same property', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking({ propertyId: 'other' })),
      },
    };
    const service = new ReviewsService(prisma as never, notifications);
    await expect(
      service.create('prop-1', customer, { bookingId: 'b1', rating: 5 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'REVIEW_NOT_ALLOWED' }),
    });
  });

  it('rejects another customer reviewing someone else stay', async () => {
    const prisma = {
      booking: {
        findUnique: jest
          .fn()
          .mockResolvedValue(booking({ customerId: 'someone-else' })),
      },
    };
    const service = new ReviewsService(prisma as never, notifications);
    await expect(
      service.create('prop-1', customer, { bookingId: 'b1', rating: 5 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'FORBIDDEN' }),
    });
  });

  it('rejects a review when the stay is not completed', async () => {
    const prisma = {
      booking: {
        findUnique: jest
          .fn()
          .mockResolvedValue(booking({ status: 'CONFIRMED' })),
      },
    };
    const service = new ReviewsService(prisma as never, notifications);
    await expect(
      service.create('prop-1', customer, { bookingId: 'b1', rating: 5 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'REVIEW_NOT_ALLOWED' }),
    });
  });

  it('rejects an owner reviewing their own listing', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(
          booking({
            customerId: 'cust-1',
            property: { id: 'prop-1', ownerId: 'cust-1', title: 'Mine' },
          }),
        ),
      },
    };
    const service = new ReviewsService(prisma as never, notifications);
    await expect(
      service.create('prop-1', customer, { bookingId: 'b1', rating: 5 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'REVIEW_NOT_ALLOWED' }),
    });
  });

  it('rejects a non-owner from responding', async () => {
    const prisma = {
      review: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'r1',
          property: { ownerId: 'owner-1' },
        }),
      },
    };
    const service = new ReviewsService(prisma as never, notifications);
    await expect(
      service.respond('r1', customer, { response: 'Thanks for staying.' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'FORBIDDEN' }),
    });
  });
});
