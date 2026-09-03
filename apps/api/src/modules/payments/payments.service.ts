import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import { ErrorCodes } from '../../common/constants/error-codes';
import { UserRoles } from '../../common/constants/roles';
import { moneyToPaise } from '../../common/money';
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
  type PaymentProvider,
} from './providers/payment-provider.interface';
import { CreatePaymentOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { assertBookingTransition } from '../bookings/booking-status';

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; status?: string } };
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

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly notifications: NotificationsService,
    private readonly availability: AvailabilityService,
    private readonly pricing: PricingService,
  ) {}

  async createOrder(user: RequestUser, dto: CreatePaymentOrderDto) {
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
        message: 'This booking is not awaiting payment.',
      });
    }

    const existing = booking.payments.find(
      (payment) =>
        payment.providerOrderId &&
        (payment.status === PaymentStatus.CREATED ||
          payment.status === PaymentStatus.PENDING),
    );
    if (existing?.providerOrderId) {
      return {
        paymentId: existing.id,
        provider: existing.provider,
        providerOrderId: existing.providerOrderId,
        amount: existing.amount,
        currency: existing.currency,
        keyId: this.keyId(),
      };
    }

    const intent = await this.provider.createIntent({
      bookingId: booking.id,
      amountPaise: moneyToPaise(booking.totalAmount),
      currency: booking.currency,
      customerEmail: booking.customer.email,
      receipt: booking.id.replace(/-/g, '').slice(0, 40),
    });

    const payment = await this.prisma.$transaction(async (tx) => {
      if (booking.status === BookingStatus.PENDING) {
        assertBookingTransition(booking.status, BookingStatus.PAYMENT_PENDING);
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.PAYMENT_PENDING },
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
        },
      });
    });

    return {
      paymentId: payment.id,
      provider: intent.provider,
      providerOrderId: intent.providerOrderId,
      amount: payment.amount,
      currency: payment.currency,
      keyId: this.keyId(),
    };
  }

  async verifyCheckout(dto: VerifyPaymentDto) {
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

    return this.confirmSuccessfulPayment(
      dto.providerOrderId,
      dto.providerPaymentId,
    );
  }

  async handleWebhook(rawBody: string, signature: string | undefined) {
    if (
      !signature ||
      !this.provider.verifyWebhookSignature(rawBody, signature)
    ) {
      throw new BadRequestException({
        errorCode: ErrorCodes.PAYMENT_NOT_VERIFIED,
        message: 'Invalid webhook signature.',
      });
    }

    const event = JSON.parse(rawBody) as RazorpayWebhook;
    const paymentEntity = event.payload?.payment?.entity;
    const refundEntity = event.payload?.refund?.entity;

    if (
      (event.event === 'payment.captured' || event.event === 'order.paid') &&
      paymentEntity?.order_id &&
      paymentEntity.id
    ) {
      return this.confirmSuccessfulPayment(
        paymentEntity.order_id,
        paymentEntity.id,
      );
    }

    if (event.event === 'payment.failed' && paymentEntity?.order_id) {
      return this.markFailed(
        paymentEntity.order_id,
        paymentEntity.status ?? 'failed',
      );
    }

    if (event.event === 'refund.processed' && refundEntity?.id) {
      return this.completeRefundFromProvider(
        refundEntity.id,
        refundEntity.payment_id,
        refundEntity.status ?? 'processed',
      );
    }

    return { ignored: true, event: event.event };
  }

  async requestRefundForBooking(bookingId: string, reason?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true },
    });
    if (!booking) {
      throw new NotFoundException({
        errorCode: ErrorCodes.BOOKING_NOT_FOUND,
        message: 'Booking not found.',
      });
    }

    const payment = booking.payments.find(
      (item) => item.status === PaymentStatus.SUCCESS,
    );
    if (!payment?.providerPaymentId) {
      return {
        refund: null,
        message:
          'No captured payment exists; dates were released without a provider refund.',
      };
    }

    const existing = await this.prisma.refund.findFirst({
      where: {
        paymentId: payment.id,
        status: {
          in: [
            RefundStatus.REQUESTED,
            RefundStatus.PROCESSING,
            RefundStatus.COMPLETED,
          ],
        },
      },
    });
    if (existing) {
      return { refund: existing };
    }

    const refund = await this.prisma.refund.create({
      data: {
        bookingId,
        paymentId: payment.id,
        amount: payment.amount,
        reason,
        status: RefundStatus.REQUESTED,
      },
    });

    const providerResult = await this.provider.createRefund({
      providerPaymentId: payment.providerPaymentId,
      amountPaise: moneyToPaise(payment.amount),
      notes: reason,
    });

    if (!providerResult.providerRefundId) {
      return this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.FAILED,
          providerStatus: providerResult.providerStatus,
        },
      });
    }

    const mapped = this.mapProviderRefundStatus(providerResult.providerStatus);
    return this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        providerRefundId: providerResult.providerRefundId,
        providerStatus: providerResult.providerStatus,
        status: mapped,
      },
    });
  }

  async confirmSuccessfulPayment(
    providerOrderId: string,
    providerPaymentId: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId },
      include: { booking: { include: { nights: true, property: true } } },
    });
    if (!payment) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Payment order not found.',
      });
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return { payment, booking: payment.booking, idempotent: true };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: { in: [PaymentStatus.CREATED, PaymentStatus.PENDING] },
        },
        data: {
          status: PaymentStatus.SUCCESS,
          providerPaymentId,
          verifiedAt: new Date(),
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
        };
      }

      const bookingStatus = payment.booking.status;
      if (
        bookingStatus === BookingStatus.PENDING ||
        bookingStatus === BookingStatus.PAYMENT_PENDING
      ) {
        assertBookingTransition(bookingStatus, BookingStatus.CONFIRMED);
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: BookingStatus.CONFIRMED },
        });
      }

      await this.availability.markBooked(
        tx as unknown as PrismaService,
        payment.booking.propertyId,
        payment.booking.nights.map((night) => night.date),
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
      };
    });

    if (!result.idempotent && result.booking) {
      await this.notifications.notify({
        userId: payment.booking.customerId,
        type: NotificationTypes.PAYMENT_SUCCESS,
        title: 'Payment received',
        body: 'Your payment was verified and the booking is confirmed.',
        metadata: { bookingId: payment.bookingId },
      });
      await this.notifications.notify({
        userId: payment.booking.customerId,
        type: NotificationTypes.BOOKING_CONFIRMED,
        title: 'Booking confirmed',
        body: `Your stay at ${payment.booking.property.title} is confirmed.`,
        metadata: { bookingId: payment.bookingId },
      });
      await this.notifications.notify({
        userId: payment.booking.property.ownerId,
        type: NotificationTypes.BOOKING_CONFIRMED,
        title: 'Booking confirmed',
        body: `A booking for ${payment.booking.property.title} is confirmed.`,
        metadata: { bookingId: payment.bookingId },
      });
    }

    return result;
  }

  private async markFailed(providerOrderId: string, reason: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId },
      include: { booking: { include: { nights: true, property: true } } },
    });
    if (!payment) {
      return { ignored: true };
    }
    if (payment.status === PaymentStatus.SUCCESS) {
      return { ignored: true, reason: 'already-success' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failureReason: reason },
      });
      if (
        payment.booking.status === BookingStatus.PENDING ||
        payment.booking.status === BookingStatus.PAYMENT_PENDING
      ) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: BookingStatus.FAILED },
        });
        await tx.bookingNight.deleteMany({
          where: { bookingId: payment.bookingId },
        });
      }
    });

    await this.notifications.notify({
      userId: payment.booking.customerId,
      type: NotificationTypes.PAYMENT_FAILURE,
      title: 'Payment failed',
      body: 'We could not verify your payment. Please try again with a new booking.',
      metadata: { bookingId: payment.bookingId },
    });

    return { failed: true };
  }

  private async completeRefundFromProvider(
    providerRefundId: string,
    providerPaymentId: string | undefined,
    providerStatus: string,
  ) {
    const refund = await this.prisma.refund.findFirst({
      where: {
        OR: [
          { providerRefundId },
          providerPaymentId ? { payment: { providerPaymentId } } : undefined,
        ].filter(Boolean) as Prisma.RefundWhereInput[],
      },
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
        },
      });
      if (mapped === RefundStatus.COMPLETED) {
        await tx.payment.update({
          where: { id: refund.paymentId },
          data: { status: PaymentStatus.REFUNDED },
        });
        await tx.booking.update({
          where: { id: refund.bookingId },
          data: { status: BookingStatus.REFUNDED },
        });
      }
      return nextRefund;
    });

    return { refund: updated, idempotent: false };
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

  private keyId(): string | null {
    return process.env.RAZORPAY_KEY_ID ?? null;
  }
}
