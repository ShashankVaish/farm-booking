import { ForbiddenException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { ErrorCodes } from '../../common/constants/error-codes';

const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  CREATED: [
    PaymentStatus.PENDING,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
    PaymentStatus.FAILED,
  ],
  PENDING: [
    PaymentStatus.PROCESSING,
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
  ],
  PROCESSING: [
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.EXPIRED,
    PaymentStatus.PENDING,
  ],
  SUCCESS: [PaymentStatus.REFUND_PENDING, PaymentStatus.REFUNDED],
  FAILED: [
    PaymentStatus.PENDING,
    PaymentStatus.PROCESSING,
    PaymentStatus.SUCCESS,
  ],
  CANCELLED: [PaymentStatus.PROCESSING, PaymentStatus.SUCCESS],
  EXPIRED: [
    PaymentStatus.PROCESSING,
    PaymentStatus.SUCCESS,
    PaymentStatus.REFUNDED,
  ],
  REFUND_PENDING: [
    PaymentStatus.REFUNDED,
    PaymentStatus.REFUND_FAILED,
    PaymentStatus.SUCCESS,
  ],
  REFUNDED: [],
  REFUND_FAILED: [PaymentStatus.REFUND_PENDING],
};

export const OPEN_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.CREATED,
  PaymentStatus.PENDING,
  PaymentStatus.PROCESSING,
];

export const CAPTURABLE_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.CREATED,
  PaymentStatus.PENDING,
  PaymentStatus.PROCESSING,
  PaymentStatus.FAILED,
  PaymentStatus.EXPIRED,
  PaymentStatus.CANCELLED,
];

export function isOpenPaymentStatus(status: PaymentStatus): boolean {
  return (
    status === PaymentStatus.CREATED ||
    status === PaymentStatus.PENDING ||
    status === PaymentStatus.PROCESSING
  );
}

export function isCapturablePaymentStatus(status: PaymentStatus): boolean {
  return (
    status === PaymentStatus.CREATED ||
    status === PaymentStatus.PENDING ||
    status === PaymentStatus.PROCESSING ||
    status === PaymentStatus.FAILED ||
    status === PaymentStatus.EXPIRED ||
    status === PaymentStatus.CANCELLED
  );
}

export function assertPaymentTransition(
  current: PaymentStatus,
  next: PaymentStatus,
): void {
  if (current === next) {
    return;
  }
  if (!TRANSITIONS[current].some((status) => status === next)) {
    throw new ForbiddenException({
      errorCode: ErrorCodes.INVALID_STATUS_TRANSITION,
      message: `Cannot change payment status from ${current} to ${next}.`,
    });
  }
}

export function canRetryPayment(status: PaymentStatus): boolean {
  return (
    status === PaymentStatus.FAILED ||
    status === PaymentStatus.CREATED ||
    status === PaymentStatus.PENDING
  );
}
