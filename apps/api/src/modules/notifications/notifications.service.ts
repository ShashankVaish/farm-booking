import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';

export const NotificationTypes = {
  BOOKING_CREATED: 'BOOKING_CREATED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILURE: 'PAYMENT_FAILURE',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  REFUND: 'REFUND',
  PROPERTY_APPROVED: 'PROPERTY_APPROVED',
  PROPERTY_REJECTED: 'PROPERTY_REJECTED',
  PROPERTY_CHANGES_REQUESTED: 'PROPERTY_CHANGES_REQUESTED',
  PROPERTY_SUSPENDED: 'PROPERTY_SUSPENDED',
  NEW_REVIEW: 'NEW_REVIEW',
  COUPON: 'COUPON',
} as const;

export type NotificationPreferenceFlags = {
  bookingConfirmation: boolean;
  paymentSuccess: boolean;
  paymentFailure: boolean;
  cancellation: boolean;
  refund: boolean;
  propertyApproval: boolean;
  propertyRejection: boolean;
  newReview: boolean;
  coupon: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceFlags = {
  bookingConfirmation: true,
  paymentSuccess: true,
  paymentFailure: true,
  cancellation: true,
  refund: true,
  propertyApproval: true,
  propertyRejection: true,
  newReview: true,
  coupon: true,
};

export function preferenceKeyForType(
  type: string,
): keyof NotificationPreferenceFlags | null {
  switch (type) {
    case NotificationTypes.BOOKING_CREATED:
    case NotificationTypes.BOOKING_CONFIRMED:
      return 'bookingConfirmation';
    case NotificationTypes.PAYMENT_SUCCESS:
      return 'paymentSuccess';
    case NotificationTypes.PAYMENT_FAILURE:
      return 'paymentFailure';
    case NotificationTypes.BOOKING_CANCELLED:
      return 'cancellation';
    case NotificationTypes.REFUND:
      return 'refund';
    case NotificationTypes.PROPERTY_APPROVED:
      return 'propertyApproval';
    case NotificationTypes.PROPERTY_REJECTED:
    case NotificationTypes.PROPERTY_CHANGES_REQUESTED:
    case NotificationTypes.PROPERTY_SUSPENDED:
      return 'propertyRejection';
    case NotificationTypes.NEW_REVIEW:
      return 'newReview';
    case NotificationTypes.COUPON:
      return 'coupon';
    default:
      return null;
  }
}

export function isNotificationAllowed(
  type: string,
  prefs: NotificationPreferenceFlags,
): boolean {
  const key = preferenceKeyForType(type);
  if (!key) {
    return true;
  }
  return prefs[key];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    metadata?: Prisma.InputJsonValue;
    dedupeKey?: string;
  }): Promise<{ created: boolean; reason?: 'preference' | 'duplicate' }> {
    const prefs = await this.getPreferences(params.userId);
    if (!isNotificationAllowed(params.type, prefs)) {
      return { created: false, reason: 'preference' };
    }

    try {
      await this.prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          body: params.body,
          metadata: params.metadata,
          dedupeKey: params.dedupeKey,
        },
      });
      return { created: true };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { created: false, reason: 'duplicate' };
      }
      this.logger.warn({
        err: error instanceof Error ? error.message : 'unknown',
        userId: params.userId,
        type: params.type,
      });
      return { created: false };
    }
  }

  async getPreferences(userId: string): Promise<NotificationPreferenceFlags> {
    const row = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!row) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
    return {
      bookingConfirmation: row.bookingConfirmation,
      paymentSuccess: row.paymentSuccess,
      paymentFailure: row.paymentFailure,
      cancellation: row.cancellation,
      refund: row.refund,
      propertyApproval: row.propertyApproval,
      propertyRejection: row.propertyRejection,
      newReview: row.newReview,
      coupon: row.coupon,
    };
  }

  async upsertPreferences(
    userId: string,
    patch: Partial<NotificationPreferenceFlags>,
  ) {
    const current = await this.getPreferences(userId);
    const data = { ...current, ...patch };
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async list(userId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return paginated(items, total, page, limit);
  }

  async markRead(userId: string, id: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return null;
    }

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: existing.readAt ?? new Date() },
    });
  }
}
