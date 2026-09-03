import { BookingStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { ErrorCodes } from '../../common/constants/error-codes';

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: [
    BookingStatus.PAYMENT_PENDING,
    BookingStatus.CANCELLED,
    BookingStatus.FAILED,
  ],
  PAYMENT_PENDING: [
    BookingStatus.CONFIRMED,
    BookingStatus.FAILED,
    BookingStatus.CANCELLED,
  ],
  CONFIRMED: [
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
    BookingStatus.REFUNDED,
  ],
  CANCELLED: [BookingStatus.REFUNDED],
  COMPLETED: [],
  FAILED: [],
  REFUNDED: [],
};

export function assertBookingTransition(
  current: BookingStatus,
  next: BookingStatus,
): void {
  if (!TRANSITIONS[current].includes(next)) {
    throw new ForbiddenException({
      errorCode: ErrorCodes.INVALID_STATUS_TRANSITION,
      message: `Cannot change booking status from ${current} to ${next}.`,
    });
  }
}

export function canCustomerCancel(status: BookingStatus): boolean {
  return (
    status === BookingStatus.PENDING ||
    status === BookingStatus.PAYMENT_PENDING ||
    status === BookingStatus.CONFIRMED
  );
}
