import { Prisma } from '@prisma/client';
import {
  isNotificationAllowed,
  NotificationsService,
  NotificationTypes,
} from './notifications.service';

describe('notification preferences', () => {
  it('honours preference flags for known types', () => {
    const off = {
      bookingConfirmation: false,
      paymentSuccess: true,
      paymentFailure: true,
      cancellation: true,
      refund: false,
      propertyApproval: true,
      propertyRejection: true,
      newReview: false,
      coupon: true,
    };
    expect(isNotificationAllowed(NotificationTypes.BOOKING_CONFIRMED, off)).toBe(
      false,
    );
    expect(isNotificationAllowed(NotificationTypes.PAYMENT_SUCCESS, off)).toBe(
      true,
    );
    expect(isNotificationAllowed(NotificationTypes.NEW_REVIEW, off)).toBe(false);
    expect(isNotificationAllowed(NotificationTypes.REFUND, off)).toBe(false);
  });
});

describe('NotificationsService', () => {
  it('lists only the authenticated user notifications', async () => {
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) =>
        Promise.all(ops),
      ),
    };
    const service = new NotificationsService(prisma as never);
    await service.list('user-1', 1, 20);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  it('does not mark another user notification as read', async () => {
    const prisma = {
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new NotificationsService(prisma as never);
    await expect(service.markRead('user-1', 'n1')).resolves.toBeNull();
  });

  it('skips delivery when the user disabled that type', async () => {
    const prisma = {
      notification: { create: jest.fn() },
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue({
          bookingConfirmation: false,
          paymentSuccess: true,
          paymentFailure: true,
          cancellation: true,
          refund: true,
          propertyApproval: true,
          propertyRejection: true,
          newReview: true,
          coupon: true,
        }),
      },
    };
    const service = new NotificationsService(prisma as never);
    const result = await service.notify({
      userId: 'u1',
      type: NotificationTypes.BOOKING_CONFIRMED,
      title: 'Confirmed',
      body: 'Stay booked',
    });
    expect(result).toEqual({ created: false, reason: 'preference' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('treats unique constraint failures as duplicates', async () => {
    const prisma = {
      notification: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique', {
            code: 'P2002',
            clientVersion: '6.0.0',
          }),
        ),
      },
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new NotificationsService(prisma as never);
    await expect(
      service.notify({
        userId: 'u1',
        type: NotificationTypes.PAYMENT_SUCCESS,
        title: 'Paid',
        body: 'ok',
        dedupeKey: 'PAYMENT_SUCCESS:b1',
      }),
    ).resolves.toEqual({ created: false, reason: 'duplicate' });
  });
});
