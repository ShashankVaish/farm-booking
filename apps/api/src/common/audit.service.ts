import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const AuditActions = {
  PAYMENT_CREATED: 'PAYMENT_CREATED',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_EXPIRED: 'PAYMENT_EXPIRED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  REFUND_REQUESTED: 'REFUND_REQUESTED',
  REFUND_COMPLETED: 'REFUND_COMPLETED',
  REFUND_FAILED: 'REFUND_FAILED',
  PROPERTY_APPROVED: 'PROPERTY_APPROVED',
  PROPERTY_REJECTED: 'PROPERTY_REJECTED',
  PROPERTY_CHANGES_REQUESTED: 'PROPERTY_CHANGES_REQUESTED',
  PROPERTY_SUSPENDED: 'PROPERTY_SUSPENDED',
  PROPERTY_RESTORED: 'PROPERTY_RESTORED',
  USER_ENABLED: 'USER_ENABLED',
  USER_DISABLED: 'USER_DISABLED',
  REVIEW_MODERATED: 'REVIEW_MODERATED',
  SUPPORT_TICKET_UPDATED: 'SUPPORT_TICKET_UPDATED',
  COUPON_CREATED: 'COUPON_CREATED',
  COUPON_UPDATED: 'COUPON_UPDATED',
  COUPON_DELETED: 'COUPON_DELETED',
  AMENITY_CREATED: 'AMENITY_CREATED',
  AMENITY_UPDATED: 'AMENITY_UPDATED',
  AMENITY_DELETED: 'AMENITY_DELETED',
  PAYMENT_RECONCILED: 'PAYMENT_RECONCILED',
} as const;

const BLOCKED_KEY =
  /(cvv|cvc|pan|card|otp|otpCode|signature|secret|password|authorization|api[_-]?key|keyId|keySecret|webhook)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) {
    return value == null ? value : '[truncated]';
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([key]) => !BLOCKED_KEY.test(key),
    );
    return Object.fromEntries(
      entries.map(([key, item]) => [key, sanitize(item, depth + 1)]),
    );
  }
  return value;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? undefined,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? undefined,
        metadata: input.metadata
          ? (sanitize(input.metadata) as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }
}
