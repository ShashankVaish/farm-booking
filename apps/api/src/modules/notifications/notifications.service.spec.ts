import { Prisma } from '@prisma/client';
import {
  isNotificationAllowed,
  NotificationsService,
  NotificationTypes,
} from './notifications.service';

/** Nothing here exercises delivery; the mail path has its own spec. */
const mail = { sendQuietly: jest.fn().mockResolvedValue(true) };
/** WhatsApp is switched off in these tests unless a test says otherwise. */
const noWhatsApp = {
  isConfigured: () => false,
  sendTemplate: jest.fn(),
};

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
      whatsapp: false,
    };
    expect(
      isNotificationAllowed(NotificationTypes.BOOKING_CONFIRMED, off),
    ).toBe(false);
    expect(isNotificationAllowed(NotificationTypes.PAYMENT_SUCCESS, off)).toBe(
      true,
    );
    expect(isNotificationAllowed(NotificationTypes.NEW_REVIEW, off)).toBe(
      false,
    );
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
    const service = new NotificationsService(
      prisma as never,
      mail as never,
      noWhatsApp as never,
    );
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
    const service = new NotificationsService(
      prisma as never,
      mail as never,
      noWhatsApp as never,
    );
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
    const service = new NotificationsService(
      prisma as never,
      mail as never,
      noWhatsApp as never,
    );
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
    const service = new NotificationsService(
      prisma as never,
      mail as never,
      noWhatsApp as never,
    );
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

describe('NotificationsService email dispatch', () => {
  const body = { subject: 'Confirmed', html: '<p>hi</p>', text: 'hi' };

  function build(options: {
    createRejects?: Error;
    prefs?: Record<string, boolean> | null;
    user?: { email: string; name: string; isActive: boolean } | null;
  }) {
    const sendQuietly = jest.fn().mockResolvedValue(true);
    const prisma = {
      notification: {
        create: options.createRejects
          ? jest.fn().mockRejectedValue(options.createRejects)
          : jest.fn().mockResolvedValue({ id: 'n1' }),
      },
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(options.prefs ?? null),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            options.user === undefined
              ? { email: 'asha@example.com', name: 'Asha Rao', isActive: true }
              : options.user,
          ),
      },
    };
    const service = new NotificationsService(
      prisma as never,
      {
        sendQuietly,
      } as never,
      noWhatsApp as never,
    );
    return { service, prisma, sendQuietly };
  }

  it('emails the recipient when the notification is written', async () => {
    const { service, sendQuietly } = build({});
    const result = await service.notify({
      userId: 'u1',
      type: NotificationTypes.BOOKING_CONFIRMED,
      title: 'Booking confirmed',
      body: 'done',
      email: body,
    });

    expect(result).toEqual({ created: true, emailed: true });
    expect(sendQuietly).toHaveBeenCalledWith({
      to: 'asha@example.com',
      ...body,
    });
  });

  it('sends nothing when no email was supplied', async () => {
    const { service, sendQuietly } = build({});
    const result = await service.notify({
      userId: 'u1',
      type: NotificationTypes.BOOKING_CONFIRMED,
      title: 'Booking confirmed',
      body: 'done',
    });

    expect(result).toEqual({ created: true, emailed: undefined });
    expect(sendQuietly).not.toHaveBeenCalled();
  });

  it('does not email when the preference is switched off', async () => {
    const { service, sendQuietly, prisma } = build({
      prefs: {
        bookingConfirmation: false,
        paymentSuccess: true,
        paymentFailure: true,
        cancellation: true,
        refund: true,
        propertyApproval: true,
        propertyRejection: true,
        newReview: true,
        coupon: true,
      },
    });

    const result = await service.notify({
      userId: 'u1',
      type: NotificationTypes.BOOKING_CONFIRMED,
      title: 'Booking confirmed',
      body: 'done',
      email: body,
    });

    expect(result).toEqual({ created: false, reason: 'preference' });
    expect(sendQuietly).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('does not send a second copy when the dedupe key collides', async () => {
    // Reconcile can settle the same capture more than once. The unique index is
    // what stops a duplicate row, and it has to stop the duplicate email too.
    const { service, sendQuietly } = build({
      createRejects: new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '6.0.0',
      }),
    });

    const result = await service.notify({
      userId: 'u1',
      type: NotificationTypes.BOOKING_CONFIRMED,
      title: 'Booking confirmed',
      body: 'done',
      dedupeKey: 'BOOKING_CONFIRMED:b1:u1',
      email: body,
    });

    expect(result).toEqual({ created: false, reason: 'duplicate' });
    expect(sendQuietly).not.toHaveBeenCalled();
  });

  it('does not email a disabled account', async () => {
    const { service, sendQuietly } = build({
      user: { email: 'asha@example.com', name: 'Asha Rao', isActive: false },
    });

    const result = await service.notify({
      userId: 'u1',
      type: NotificationTypes.BOOKING_CONFIRMED,
      title: 'Booking confirmed',
      body: 'done',
      email: body,
    });

    // The in-app row is still written for the audit trail.
    expect(result).toEqual({ created: true, emailed: false });
    expect(sendQuietly).not.toHaveBeenCalled();
  });

  it('does not throw when the user row has gone', async () => {
    const { service, sendQuietly } = build({ user: null });
    await expect(
      service.notify({
        userId: 'gone',
        type: NotificationTypes.BOOKING_CONFIRMED,
        title: 'Booking confirmed',
        body: 'done',
        email: body,
      }),
    ).resolves.toEqual({ created: true, emailed: false });
    expect(sendQuietly).not.toHaveBeenCalled();
  });

  it('renders a function form against the resolved recipient, not the caller', async () => {
    // The same booking notifies the guest and the host. Whichever name was in
    // scope at the call site is not necessarily the one being written to, so
    // the template is handed the row that notify actually looked up.
    const { service, sendQuietly } = build({});
    await service.notify({
      userId: 'owner-1',
      type: NotificationTypes.BOOKING_CONFIRMED,
      title: 'Booking confirmed',
      body: 'done',
      email: (recipient) => ({
        subject: `For ${recipient.name}`,
        html: `<p>${recipient.email}</p>`,
        text: recipient.name,
      }),
    });

    expect(sendQuietly).toHaveBeenCalledWith({
      to: 'asha@example.com',
      subject: 'For Asha Rao',
      html: '<p>asha@example.com</p>',
      text: 'Asha Rao',
    });
  });

  it('still reports the notification as created when the email fails', async () => {
    const sendQuietly = jest.fn().mockResolvedValue(false);
    const prisma = {
      notification: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
      notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ email: 'a@b.com', name: 'A', isActive: true }),
      },
    };
    const service = new NotificationsService(
      prisma as never,
      { sendQuietly } as never,
      noWhatsApp as never,
    );

    // A guest who has paid is still confirmed whether or not Titan was up.
    await expect(
      service.notify({
        userId: 'u1',
        type: NotificationTypes.BOOKING_CONFIRMED,
        title: 'Booking confirmed',
        body: 'done',
        email: body,
      }),
    ).resolves.toEqual({ created: true, emailed: false });
  });
});

describe('NotificationsService WhatsApp delivery', () => {
  const template = { name: 'booking_confirmed', bodyParams: ['Asha'] };
  const verifiedUser = {
    email: 'asha@example.com',
    name: 'Asha Rao',
    phone: '9876543210',
    phoneVerifiedAt: new Date('2026-09-01'),
    isActive: true,
  };

  function build(options: {
    optedIn?: boolean;
    user?: Record<string, unknown> | null;
    configured?: boolean;
  }) {
    const whatsapp = {
      isConfigured: () => options.configured ?? true,
      sendTemplate: jest.fn().mockResolvedValue(true),
    };
    const prisma = {
      notification: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(
          options.optedIn === false
            ? null
            : {
                bookingConfirmation: true,
                paymentSuccess: true,
                paymentFailure: true,
                cancellation: true,
                refund: true,
                propertyApproval: true,
                propertyRejection: true,
                newReview: true,
                coupon: true,
                whatsapp: true,
              },
        ),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            options.user === undefined ? verifiedUser : options.user,
          ),
      },
    };
    const service = new NotificationsService(
      prisma as never,
      mail as never,
      whatsapp as never,
    );
    const send = (extra: Record<string, unknown> = {}) =>
      service.notify({
        userId: 'u1',
        type: NotificationTypes.BOOKING_CONFIRMED,
        title: 'Booking confirmed',
        body: 'done',
        whatsapp: template,
        ...extra,
      });
    return { send, whatsapp };
  }

  it('sends to a verified, opted-in phone', async () => {
    const { send, whatsapp } = build({});
    await expect(send()).resolves.toMatchObject({ whatsapped: true });
    expect(whatsapp.sendTemplate).toHaveBeenCalledWith('9876543210', template);
  });

  it('builds the template for the resolved recipient', async () => {
    const { send, whatsapp } = build({});
    await send({
      whatsapp: (to: { name: string }) => ({
        name: 'booking_confirmed',
        bodyParams: [to.name],
      }),
    });
    expect(whatsapp.sendTemplate).toHaveBeenCalledWith('9876543210', {
      name: 'booking_confirmed',
      bodyParams: ['Asha Rao'],
    });
  });

  it('never sends without the WhatsApp opt-in, which is off by default', async () => {
    const { send, whatsapp } = build({ optedIn: false });
    await send();
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('never sends to a phone that was not verified', async () => {
    const { send, whatsapp } = build({
      user: { ...verifiedUser, phoneVerifiedAt: null },
    });
    await expect(send()).resolves.toMatchObject({ whatsapped: false });
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('never sends to a disabled account or one without a phone', async () => {
    const disabled = build({ user: { ...verifiedUser, isActive: false } });
    await disabled.send();
    expect(disabled.whatsapp.sendTemplate).not.toHaveBeenCalled();
    const noPhone = build({ user: { ...verifiedUser, phone: null } });
    await noPhone.send();
    expect(noPhone.whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('does nothing when WhatsApp is not configured on the server', async () => {
    const { send, whatsapp } = build({ configured: false });
    await expect(send()).resolves.toMatchObject({
      created: true,
      whatsapped: false,
    });
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });
});
