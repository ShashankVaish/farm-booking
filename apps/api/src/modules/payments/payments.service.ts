import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AuditActions, AuditService } from '../../common/audit.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { UserRoles } from '../../common/constants/roles';
import { money, moneyToPaise, paiseToMoney } from '../../common/money';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import type { RequestUser } from '../auth/auth.types';
import {
  NotificationTypes,
  NotificationsService,
} from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';
import {
  PAYMENT_PROVIDER,
  type FetchPaymentResult,
  type PaymentProvider,
} from './providers/payment-provider.interface';
import { CreatePaymentOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { assertBookingTransition } from '../bookings/booking-status';
import {
  CAPTURABLE_PAYMENT_STATUSES,
  OPEN_PAYMENT_STATUSES,
  assertPaymentTransition,
  isOpenPaymentStatus,
} from './payment-status';

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
        amount?: number;
      };
    };
    refund?: {
      entity?: {
        id?: string;
        payment_id?: string;
        status?: string;
        amount?: number;
      };
    };
  };
};

const paymentBookingInclude = {
  booking: { include: { nights: true, property: true } },
} as const;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly notifications: NotificationsService,
    private readonly availability: AvailabilityService,
    private readonly pricing: PricingService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async createOrder(user: RequestUser, dto: CreatePaymentOrderDto) {
    await this.recoverOpenBooking(dto.bookingId);

    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { customer: true, payments: true },
    });
    if (!booking) {
      throw new NotFoundException({
        errorCode: ErrorCodes.BOOKING_NOT_FOUND,
        message: 'Booking not found.',
      });
    }
    if (booking.customerId !== user.id && user.role !== UserRoles.ADMIN) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'You cannot pay for this booking.',
      });
    }
    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.PAYMENT_PENDING
    ) {
      throw new BadRequestException({
        errorCode: ErrorCodes.INVALID_STATUS_TRANSITION,
        message:
          booking.status === BookingStatus.EXPIRED
            ? 'This booking expired. Start a new reservation.'
            : 'This booking is not awaiting payment.',
      });
    }

    await this.availability.assertRangeAvailable(
      booking.propertyId,
      booking.checkInDate,
      booking.checkOutDate,
      this.prisma,
      booking.id,
    );

    const existing = booking.payments.find(
      (payment) =>
        payment.providerOrderId && isOpenPaymentStatus(payment.status),
    );
    if (existing?.providerOrderId) {
      return this.orderPayload(existing);
    }

    const expiresAt = new Date(Date.now() + this.expireMinutes() * 60 * 1000);
    const amountPaise = moneyToPaise(booking.totalAmount);

    const payment = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "Booking" WHERE id = ${booking.id}::uuid FOR UPDATE`,
        );

        const open = await tx.payment.findFirst({
          where: {
            bookingId: booking.id,
            status: { in: OPEN_PAYMENT_STATUSES },
          },
        });
        if (open?.providerOrderId) {
          return open;
        }

        const intent = await this.provider.createIntent({
          bookingId: booking.id,
          amountPaise,
          currency: booking.currency,
          customerEmail: booking.customer.email,
          receipt: `bk${booking.id.replace(/-/g, '').slice(0, 38)}`,
        });

        if (intent.amountPaise !== amountPaise) {
          throw new BadRequestException({
            errorCode: ErrorCodes.PAYMENT_AMOUNT_MISMATCH,
            message: 'Gateway order amount does not match the booking total.',
          });
        }

        if (booking.status === BookingStatus.PENDING) {
          assertBookingTransition(
            booking.status,
            BookingStatus.PAYMENT_PENDING,
          );
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.PAYMENT_PENDING },
          });
        }

        if (open && !open.providerOrderId) {
          assertPaymentTransition(open.status, PaymentStatus.PENDING);
          return tx.payment.update({
            where: { id: open.id },
            data: {
              providerOrderId: intent.providerOrderId,
              status: PaymentStatus.PENDING,
              amount: booking.totalAmount,
              currency: booking.currency,
              expiresAt,
            },
          });
        }

        return tx.payment.create({
          data: {
            bookingId: booking.id,
            provider: 'RAZORPAY',
            providerOrderId: intent.providerOrderId,
            amount: booking.totalAmount,
            currency: booking.currency,
            status: PaymentStatus.PENDING,
            expiresAt,
          },
        });
      },
      { timeout: 25_000, maxWait: 10_000 },
    );

    await this.audit.record({
      actorId: user.id,
      action: AuditActions.PAYMENT_CREATED,
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        bookingId: booking.id,
        providerOrderId: payment.providerOrderId,
        amount: money(payment.amount).toFixed(2),
        currency: payment.currency,
      },
    });

    return this.orderPayload(payment);
  }

  async verifyCheckout(user: RequestUser, dto: VerifyPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId: dto.providerOrderId },
      include: { booking: true },
    });
    if (!payment) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Payment order not found.',
      });
    }
    if (
      payment.booking.customerId !== user.id &&
      user.role !== UserRoles.ADMIN
    ) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'You cannot verify this payment.',
      });
    }

    const verified = await this.provider.verifyPayment(dto);
    if (!verified.verified) {
      await this.markFailed(
        dto.providerOrderId,
        'Signature verification failed',
      );
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_NOT_VERIFIED,
        message: 'Payment signature is not valid.',
      });
    }

    return this.settleCapturedPayment(
      dto.providerOrderId,
      dto.providerPaymentId,
      user.id,
    );
  }

  async handleWebhook(
    rawBody: string,
    signature: string | undefined,
    eventIdHeader?: string,
  ) {
    if (
      !signature ||
      !this.provider.verifyWebhookSignature(rawBody, signature)
    ) {
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_NOT_VERIFIED,
        message: 'Invalid webhook signature.',
      });
    }

    const eventId =
      eventIdHeader || createHash('sha256').update(rawBody).digest('hex');
    const duplicate = await this.prisma.processedWebhookEvent.findUnique({
      where: { id: eventId },
    });
    if (duplicate) {
      return { idempotent: true, event: duplicate.event };
    }

    let event: RazorpayWebhook;
    try {
      event = JSON.parse(rawBody) as RazorpayWebhook;
    } catch {
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_NOT_VERIFIED,
        message: 'Webhook body is not valid JSON.',
      });
    }
    const paymentEntity = event.payload?.payment?.entity;
    const refundEntity = event.payload?.refund?.entity;

    let result: unknown = { ignored: true, event: event.event };

    if (
      (event.event === 'payment.captured' || event.event === 'order.paid') &&
      paymentEntity?.order_id &&
      paymentEntity.id
    ) {
      result = await this.settleCapturedPayment(
        paymentEntity.order_id,
        paymentEntity.id,
      );
    } else if (event.event === 'payment.failed' && paymentEntity?.order_id) {
      result = await this.markFailed(
        paymentEntity.order_id,
        paymentEntity.status ?? 'failed',
      );
    } else if (
      event.event === 'refund.processed' &&
      refundEntity?.id &&
      refundEntity.payment_id
    ) {
      result = await this.completeRefundFromProvider(
        refundEntity.id,
        refundEntity.payment_id,
        refundEntity.status ?? 'processed',
        refundEntity.amount,
      );
    } else if (
      event.event === 'refund.failed' &&
      refundEntity?.id &&
      refundEntity.payment_id
    ) {
      result = await this.completeRefundFromProvider(
        refundEntity.id,
        refundEntity.payment_id,
        refundEntity.status ?? 'failed',
        refundEntity.amount,
      );
    }

    await this.prisma.processedWebhookEvent
      .create({
        data: { id: eventId, event: event.event ?? 'unknown' },
      })
      .catch((error: Prisma.PrismaClientKnownRequestError) => {
        if (error.code !== 'P2002') {
          throw error;
        }
      });

    return result;
  }

  async requestRefundForBooking(
    bookingId: string,
    reason?: string,
    amountOverride?: number,
    paymentId?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: { include: { refunds: true } } },
    });
    if (!booking) {
      throw new NotFoundException({
        errorCode: ErrorCodes.BOOKING_NOT_FOUND,
        message: 'Booking not found.',
      });
    }

    const payment = (booking.payments ?? []).find((item) =>
      paymentId
        ? item.id === paymentId
        : item.status === PaymentStatus.SUCCESS ||
          item.status === PaymentStatus.REFUND_PENDING ||
          item.status === PaymentStatus.REFUND_FAILED,
    );
    if (!payment?.providerPaymentId) {
      return {
        refund: null,
        message:
          'No captured payment exists; dates were released without a provider refund.',
      };
    }

    const refundedPaise = (payment.refunds ?? [])
      .filter((row) => row.status === RefundStatus.COMPLETED)
      .reduce((sum, row) => sum + moneyToPaise(row.amount), 0);
    const capturedPaise = moneyToPaise(payment.amount);
    const remainingPaise = capturedPaise - refundedPaise;
    if (remainingPaise <= 0) {
      return {
        refund: payment.refunds.find(
          (row) => row.status === RefundStatus.COMPLETED,
        ),
      };
    }

    const requestedPaise =
      amountOverride != null ? moneyToPaise(amountOverride) : remainingPaise;
    if (requestedPaise <= 0 || requestedPaise > remainingPaise) {
      throw new BadRequestException({
        errorCode: ErrorCodes.REFUND_NOT_ELIGIBLE,
        message: 'Refund amount is not eligible for this payment.',
      });
    }

    const existingOpen = await this.prisma.refund.findFirst({
      where: {
        paymentId: payment.id,
        status: { in: [RefundStatus.REQUESTED, RefundStatus.PROCESSING] },
      },
    });
    if (existingOpen) {
      return { refund: existingOpen };
    }

    const refund = await this.prisma.refund.create({
      data: {
        bookingId,
        paymentId: payment.id,
        amount: paiseToMoney(requestedPaise),
        reason,
        status: RefundStatus.REQUESTED,
      },
    });

    if (requestedPaise === remainingPaise) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REFUND_PENDING },
      });
    }

    await this.audit.record({
      action: AuditActions.REFUND_REQUESTED,
      entityType: 'Refund',
      entityId: refund.id,
      metadata: {
        bookingId,
        paymentId: payment.id,
        amountPaise: requestedPaise,
        reason,
      },
    });

    const providerResult = await this.provider.createRefund({
      providerPaymentId: payment.providerPaymentId,
      amountPaise: requestedPaise,
      notes: reason,
    });

    if (!providerResult.providerRefundId) {
      const failed = await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.FAILED,
          providerStatus: providerResult.providerStatus,
        },
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REFUND_FAILED },
      });
      await this.audit.record({
        action: AuditActions.REFUND_FAILED,
        entityType: 'Refund',
        entityId: failed.id,
        metadata: { bookingId, providerStatus: providerResult.providerStatus },
      });
      return { refund: failed };
    }

    const mapped = this.mapProviderRefundStatus(providerResult.providerStatus);
    const updated = await this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        providerRefundId: providerResult.providerRefundId,
        providerStatus: providerResult.providerStatus,
        status: mapped,
      },
    });
    if (mapped === RefundStatus.COMPLETED) {
      await this.finalizeRefundedPayment(payment.id, bookingId);
    }
    return { refund: updated };
  }

  async settleCapturedPayment(
    providerOrderId: string,
    providerPaymentId: string,
    actorId?: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId },
      include: paymentBookingInclude,
    });
    if (!payment) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Payment order not found.',
      });
    }

    if (
      payment.status === PaymentStatus.SUCCESS ||
      payment.status === PaymentStatus.REFUND_PENDING ||
      payment.status === PaymentStatus.REFUNDED ||
      payment.status === PaymentStatus.REFUND_FAILED
    ) {
      return { payment, booking: payment.booking, idempotent: true };
    }

    const remote = await this.requireCapturedFacts(payment, providerPaymentId);

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: { in: CAPTURABLE_PAYMENT_STATUSES },
        },
        data: {
          status: PaymentStatus.PROCESSING,
          providerPaymentId: remote.providerPaymentId,
        },
      });

      if (locked.count === 0) {
        const current = await tx.payment.findUnique({
          where: { id: payment.id },
          include: { booking: true },
        });
        return {
          payment: current,
          booking: current?.booking,
          idempotent: true,
          confirm: false,
          refundInventory: false,
        };
      }

      const nights = await tx.bookingNight.findMany({
        where: { bookingId: payment.bookingId },
      });
      const booking = await tx.booking.findUnique({
        where: { id: payment.bookingId },
      });
      const canConfirm =
        nights.length > 0 &&
        booking &&
        (booking.status === BookingStatus.PENDING ||
          booking.status === BookingStatus.PAYMENT_PENDING);

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          providerPaymentId: remote.providerPaymentId,
          verifiedAt: new Date(),
          failureReason: null,
        },
      });

      if (canConfirm) {
        assertBookingTransition(booking.status, BookingStatus.CONFIRMED);
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: BookingStatus.CONFIRMED },
        });
        await this.availability.markBooked(
          tx as unknown as PrismaService,
          payment.booking.propertyId,
          nights.map((night) => night.date),
        );
        await tx.commission.upsert({
          where: { bookingId: payment.bookingId },
          update: {},
          create: {
            bookingId: payment.bookingId,
            rateBps: this.pricing.platformFeeBps(),
            amount: payment.booking.platformFee,
          },
        });
      }

      const updatedPayment = await tx.payment.findUnique({
        where: { id: payment.id },
      });
      const updatedBooking = await tx.booking.findUnique({
        where: { id: payment.bookingId },
      });
      return {
        payment: updatedPayment,
        booking: updatedBooking,
        idempotent: false,
        confirm: Boolean(canConfirm),
        refundInventory: !canConfirm,
      };
    });

    if (result.idempotent) {
      return result;
    }

    await this.audit.record({
      actorId,
      action: AuditActions.PAYMENT_VERIFIED,
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        bookingId: payment.bookingId,
        providerOrderId,
        providerPaymentId: remote.providerPaymentId,
        amount: money(payment.amount).toFixed(2),
      },
    });

    if (result.confirm && result.booking) {
      await this.audit.record({
        actorId,
        action: AuditActions.BOOKING_CONFIRMED,
        entityType: 'Booking',
        entityId: payment.bookingId,
        metadata: { paymentId: payment.id },
      });
      await this.notifications.notify({
        userId: payment.booking.customerId,
        type: NotificationTypes.PAYMENT_SUCCESS,
        title: 'Payment received',
        body: 'Your payment was verified and the booking is confirmed.',
        metadata: { bookingId: payment.bookingId },
        dedupeKey: `PAYMENT_SUCCESS:${payment.bookingId}`,
      });
      await this.notifications.notify({
        userId: payment.booking.customerId,
        type: NotificationTypes.BOOKING_CONFIRMED,
        title: 'Booking confirmed',
        body: `Your stay at ${payment.booking.property.title} is confirmed.`,
        metadata: { bookingId: payment.bookingId },
        dedupeKey: `BOOKING_CONFIRMED:${payment.bookingId}:${payment.booking.customerId}`,
      });
      await this.notifications.notify({
        userId: payment.booking.property.ownerId,
        type: NotificationTypes.BOOKING_CONFIRMED,
        title: 'Booking confirmed',
        body: `A booking for ${payment.booking.property.title} is confirmed.`,
        metadata: { bookingId: payment.bookingId },
        dedupeKey: `BOOKING_CONFIRMED:${payment.bookingId}:${payment.booking.property.ownerId}`,
      });
    }

    if (result.refundInventory) {
      await this.requestRefundForBooking(
        payment.bookingId,
        'Captured after inventory was released',
        undefined,
        payment.id,
      );
    }

    return result;
  }

  private async requireCapturedFacts(
    payment: {
      providerOrderId: string | null;
      bookingId: string;
      amount: Prisma.Decimal;
      currency: string;
      booking: { totalAmount: Prisma.Decimal };
    },
    providerPaymentId: string,
  ): Promise<FetchPaymentResult> {
    const remote = await this.provider.fetchPayment(providerPaymentId);
    if (!remote) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_ERROR,
        message: 'Could not load this payment from the gateway.',
      });
    }
    if (!remote.captured) {
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_NOT_VERIFIED,
        message: 'Payment is not captured at the gateway.',
      });
    }
    if (
      !payment.providerOrderId ||
      remote.providerOrderId !== payment.providerOrderId
    ) {
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_NOT_VERIFIED,
        message: 'Payment does not belong to this order.',
      });
    }
    const expectedPaise = moneyToPaise(payment.amount);
    const bookingPaise = moneyToPaise(payment.booking.totalAmount);
    if (
      expectedPaise !== bookingPaise ||
      remote.amountPaise !== expectedPaise
    ) {
      await this.refundCapturedAnomaly(
        remote,
        'amount_mismatch',
        payment.bookingId,
      );
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_AMOUNT_MISMATCH,
        message: 'Paid amount does not match the booking total.',
      });
    }
    if (remote.bookingId && remote.bookingId !== payment.bookingId) {
      await this.refundCapturedAnomaly(
        remote,
        'booking_mismatch',
        payment.bookingId,
      );
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_NOT_VERIFIED,
        message: 'Payment booking does not match this reservation.',
      });
    }
    if (remote.currency && remote.currency !== payment.currency) {
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_AMOUNT_MISMATCH,
        message: 'Payment currency does not match the booking.',
      });
    }
    return remote;
  }

  private async markFailed(providerOrderId: string, reason: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId },
      include: { booking: { include: { property: true } } },
    });
    if (!payment) {
      return { ignored: true };
    }
    if (
      payment.status === PaymentStatus.SUCCESS ||
      payment.status === PaymentStatus.REFUND_PENDING ||
      payment.status === PaymentStatus.REFUNDED
    ) {
      return { ignored: true, reason: 'already-success' };
    }

    assertPaymentTransition(payment.status, PaymentStatus.FAILED);
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED, failureReason: reason },
    });

    await this.audit.record({
      action: AuditActions.PAYMENT_FAILED,
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { bookingId: payment.bookingId, reason },
    });

    await this.notifications.notify({
      userId: payment.booking.customerId,
      type: NotificationTypes.PAYMENT_FAILURE,
      title: 'Payment failed',
      body: 'We could not complete your payment. You can retry from the same booking.',
      metadata: { bookingId: payment.bookingId },
      dedupeKey: `PAYMENT_FAILURE:${payment.id}`,
    });

    return { failed: true };
  }

  private async refundCapturedAnomaly(
    remote: FetchPaymentResult,
    reason: string,
    bookingId: string,
  ) {
    await this.audit.record({
      action: AuditActions.PAYMENT_FAILED,
      entityType: 'Payment',
      metadata: {
        reason,
        bookingId,
        providerPaymentId: remote.providerPaymentId,
        remotePaise: remote.amountPaise,
      },
    });
    const refund = await this.provider.createRefund({
      providerPaymentId: remote.providerPaymentId,
      amountPaise: remote.amountPaise,
      notes: reason,
    });
    await this.audit.record({
      action: refund.providerRefundId
        ? AuditActions.REFUND_REQUESTED
        : AuditActions.REFUND_FAILED,
      entityType: 'Payment',
      metadata: {
        reason,
        bookingId,
        providerRefundId: refund.providerRefundId,
        providerStatus: refund.providerStatus,
      },
    });
  }

  private async completeRefundFromProvider(
    providerRefundId: string,
    providerPaymentId: string,
    providerStatus: string,
    amountPaise?: number,
  ) {
    const refund = await this.prisma.refund.findFirst({
      where: {
        OR: [{ providerRefundId }, { payment: { providerPaymentId } }],
      },
      include: { payment: true },
    });
    if (!refund) {
      return { ignored: true };
    }
    if (refund.status === RefundStatus.COMPLETED) {
      return { refund, idempotent: true };
    }

    const mapped = this.mapProviderRefundStatus(providerStatus);
    const updated = await this.prisma.$transaction(async (tx) => {
      const nextRefund = await tx.refund.update({
        where: { id: refund.id },
        data: {
          providerRefundId,
          providerStatus,
          status: mapped,
          ...(amountPaise != null ? { amount: paiseToMoney(amountPaise) } : {}),
        },
      });
      return nextRefund;
    });

    if (mapped === RefundStatus.COMPLETED) {
      await this.finalizeRefundedPayment(refund.paymentId, refund.bookingId);
      await this.audit.record({
        action: AuditActions.REFUND_COMPLETED,
        entityType: 'Refund',
        entityId: refund.id,
        metadata: { bookingId: refund.bookingId, providerRefundId },
      });
    }
    if (mapped === RefundStatus.FAILED) {
      await this.prisma.payment.update({
        where: { id: refund.paymentId },
        data: { status: PaymentStatus.REFUND_FAILED },
      });
      await this.audit.record({
        action: AuditActions.REFUND_FAILED,
        entityType: 'Refund',
        entityId: refund.id,
        metadata: { bookingId: refund.bookingId, providerRefundId },
      });
    }

    return { refund: updated, idempotent: false };
  }

  private async finalizeRefundedPayment(paymentId: string, bookingId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true, booking: true },
    });
    if (!payment?.booking) {
      return;
    }
    const completed = (payment.refunds ?? [])
      .filter((row) => row.status === RefundStatus.COMPLETED)
      .reduce((sum, row) => sum + moneyToPaise(row.amount), 0);
    if (completed < moneyToPaise(payment.amount)) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.SUCCESS },
      });
      return;
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REFUNDED },
    });
    if (payment.booking.status !== BookingStatus.REFUNDED) {
      assertBookingTransition(payment.booking.status, BookingStatus.REFUNDED);
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.REFUNDED },
      });
    }
    await this.notifications.notify({
      userId: payment.booking.customerId,
      type: NotificationTypes.REFUND,
      title: 'Refund processed',
      body: 'A refund for your booking has been completed.',
      metadata: { bookingId, paymentId },
      dedupeKey: `REFUND:${bookingId}:${paymentId}`,
    });
  }

  private mapProviderRefundStatus(providerStatus: string): RefundStatus {
    const normalized = providerStatus.toLowerCase();
    if (normalized === 'processed' || normalized === 'completed') {
      return RefundStatus.COMPLETED;
    }
    if (normalized === 'failed' || normalized === 'cancelled') {
      return RefundStatus.FAILED;
    }
    return RefundStatus.PROCESSING;
  }

  async recoverOpenBooking(bookingId: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        bookingId,
        status: { in: OPEN_PAYMENT_STATUSES },
        providerOrderId: { not: null },
      },
    });
    for (const payment of payments) {
      if (payment.providerOrderId) {
        await this.reconcile(payment.id);
      }
    }
    await this.expireAbandoned(bookingId);
  }

  async expireAbandoned(bookingId?: string): Promise<{ expired: number }> {
    const minutes = this.expireMinutes();
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const stale = await this.prisma.booking.findMany({
      where: {
        ...(bookingId ? { id: bookingId } : {}),
        status: {
          in: [BookingStatus.PENDING, BookingStatus.PAYMENT_PENDING],
        },
        createdAt: { lt: cutoff },
      },
      include: {
        nights: true,
        payments: true,
      },
    });

    let expired = 0;
    for (const booking of stale) {
      let captured = false;
      for (const payment of booking.payments) {
        if (!payment.providerOrderId) continue;
        const remote = await this.provider.fetchOrder(payment.providerOrderId);
        if (remote?.status === 'SUCCESS' && remote.providerPaymentId) {
          await this.settleCapturedPayment(
            payment.providerOrderId,
            remote.providerPaymentId,
          );
          captured = true;
          break;
        }
      }
      if (captured) {
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.bookingNight.deleteMany({ where: { bookingId: booking.id } });
        await this.availability.releaseBooked(
          tx as unknown as PrismaService,
          booking.propertyId,
          booking.nights.map((night) => night.date),
        );
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.EXPIRED },
        });
        await tx.payment.updateMany({
          where: {
            bookingId: booking.id,
            status: { in: OPEN_PAYMENT_STATUSES },
          },
          data: {
            status: PaymentStatus.EXPIRED,
            failureReason: 'expired',
          },
        });
      });
      await this.audit.record({
        action: AuditActions.PAYMENT_EXPIRED,
        entityType: 'Booking',
        entityId: booking.id,
        metadata: { reason: 'unpaid_timeout' },
      });
      expired += 1;
    }

    return { expired };
  }

  async reconcile(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment?.providerOrderId) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Payment not found.',
      });
    }
    if (
      payment.status === PaymentStatus.SUCCESS ||
      payment.status === PaymentStatus.REFUNDED ||
      payment.status === PaymentStatus.REFUND_PENDING
    ) {
      return { payment, reconciled: true, idempotent: true };
    }

    const remote = await this.provider.fetchOrder(payment.providerOrderId);
    if (!remote) {
      return { payment, reconciled: false };
    }
    if (remote.status === 'SUCCESS' && remote.providerPaymentId) {
      return this.settleCapturedPayment(
        payment.providerOrderId,
        remote.providerPaymentId,
      );
    }
    if (remote.status === 'FAILED') {
      return this.markFailed(payment.providerOrderId, 'reconciled-failed');
    }
    return { payment, remoteStatus: remote.status, reconciled: false };
  }

  async reconcileForUser(user: RequestUser, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true, property: true },
    });
    if (!booking) {
      throw new NotFoundException({
        errorCode: ErrorCodes.BOOKING_NOT_FOUND,
        message: 'Booking not found.',
      });
    }
    if (
      booking.customerId !== user.id &&
      booking.property.ownerId !== user.id &&
      user.role !== UserRoles.ADMIN
    ) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'You cannot reconcile this payment.',
      });
    }
    await this.recoverOpenBooking(bookingId);
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async cancelOpenPayments(bookingId: string) {
    await this.prisma.payment.updateMany({
      where: {
        bookingId,
        status: { in: [PaymentStatus.CREATED, PaymentStatus.PENDING] },
      },
      data: { status: PaymentStatus.CANCELLED },
    });
  }

  private expireMinutes(): number {
    return this.config.get<number>('BOOKING_EXPIRE_MINUTES', 30);
  }

  private orderPayload(payment: {
    id: string;
    provider: string;
    providerOrderId: string | null;
    amount: Prisma.Decimal;
    currency: string;
  }) {
    return {
      paymentId: payment.id,
      provider: payment.provider,
      providerOrderId: payment.providerOrderId,
      amount: payment.amount,
      currency: payment.currency,
      keyId: this.keyId(),
    };
  }

  private keyId(): string | null {
    return process.env.RAZORPAY_KEY_ID ?? null;
  }
}
