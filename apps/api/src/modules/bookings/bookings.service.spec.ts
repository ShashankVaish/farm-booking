import { BookingStatus, Prisma } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';

const customer: RequestUser = {
  id: 'cust-1',
  email: 'c@example.com',
  role: UserRoles.CUSTOMER,
  name: 'Customer',
};

function breakdown() {
  return {
    nights: 1,
    weekdayNights: 1,
    weekendNights: 0,
    extraGuests: 0,
    baseAmount: '1000.00',
    weekendAmount: '0.00',
    extraGuestAmount: '0.00',
    platformFee: '50.00',
    discountAmount: '0.00',
    totalAmount: '1050.00',
    currency: 'INR',
  };
}

describe('BookingsService', () => {
  const property = {
    id: 'prop-1',
    ownerId: 'owner-1',
    title: 'Lake House',
    status: 'APPROVED',
    guestCapacity: 8,
    basePrice: '1000',
    weekendPrice: null,
    extraGuestCharge: null,
  };

  function setup(overrides?: {
    createManyError?: boolean;
    secondCallFails?: boolean;
  }) {
    let nightInserts = 0;
    const tx = {
      booking: {
        create: jest.fn().mockResolvedValue({
          id: 'b1',
          status: BookingStatus.PENDING,
        }),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      bookingNight: {
        deleteMany: jest.fn(),
      },
      availability: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
    };

    const prisma = {
      property: { findUnique: jest.fn().mockResolvedValue(property) },
      booking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(
        async (fn: (client: typeof tx) => Promise<unknown>) => {
          nightInserts += 1;
          if (
            overrides?.createManyError ||
            (overrides?.secondCallFails && nightInserts > 1)
          ) {
            throw new Prisma.PrismaClientKnownRequestError(
              'Unique constraint',
              {
                code: 'P2002',
                clientVersion: '6.0.0',
              },
            );
          }
          return fn(tx);
        },
      ),
    };

    const pricing = { quote: jest.fn().mockReturnValue(breakdown()) };
    const coupons = {
      getActiveByCode: jest.fn(),
      incrementRedemption: jest.fn(),
      decrementRedemption: jest.fn(),
      assertValid: jest.fn(),
    };
    const availability = {
      assertRangeAvailable: jest
        .fn()
        .mockResolvedValue([new Date('2026-10-01')]),
      releaseBooked: jest.fn(),
    };
    const notifications = { notify: jest.fn().mockResolvedValue(undefined) };

    const service = new BookingsService(
      prisma as never,
      pricing as never,
      coupons as never,
      availability as never,
      notifications as never,
    );

    return { service, prisma, tx, availability, notifications };
  }

  it('creates a booking after server-side price calculation', async () => {
    const { service, prisma } = setup();
    const result = await service.create(customer, {
      propertyId: 'prop-1',
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-02',
      guestCount: 2,
    });
    expect(result.pricing.totalAmount).toBe('1050.00');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects a concurrent double-booking uniqueness failure', async () => {
    const { service } = setup({ secondCallFails: true });
    const dto = {
      propertyId: 'prop-1',
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-02',
      guestCount: 2,
    };
    await service.create(customer, dto);
    await expect(service.create(customer, dto)).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'DATES_UNAVAILABLE' }),
    });
  });

  it('cancels a pending booking and releases nights', async () => {
    const { service, prisma, availability, notifications } = setup();
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      customerId: customer.id,
      propertyId: 'prop-1',
      status: BookingStatus.PENDING,
      couponId: null,
      nights: [{ date: new Date('2026-10-01') }],
      property: { ownerId: 'owner-1', title: 'Lake House' },
    });
    prisma.$transaction.mockImplementation(
      async (fn: (tx: never) => Promise<unknown>) =>
        fn({
          bookingNight: { deleteMany: jest.fn() },
          booking: {
            update: jest.fn().mockResolvedValue({
              id: 'b1',
              status: BookingStatus.CANCELLED,
            }),
          },
        } as never),
    );

    const result = await service.cancel('b1', customer, {});
    expect(result.booking.status).toBe(BookingStatus.CANCELLED);
    expect(availability.releaseBooked).toHaveBeenCalled();
    expect(notifications.notify).toHaveBeenCalled();
  });
});
