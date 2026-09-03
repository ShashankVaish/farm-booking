import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, PropertyStatus } from '@prisma/client';
import { ErrorCodes } from '../../common/constants/error-codes';
import { UserRoles } from '../../common/constants/roles';
import {
  datesAreValidRange,
  enumerateNights,
  toUtcDateOnly,
} from '../../common/dates';
import { money } from '../../common/money';
import { paginated } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import type { RequestUser } from '../auth/auth.types';
import { CouponsService } from '../coupons/coupons.service';
import {
  NotificationTypes,
  NotificationsService,
} from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';
import {
  CancelBookingDto,
  CreateBookingDto,
  QuoteBookingDto,
} from './dto/booking.dto';
import { assertBookingTransition, canCustomerCancel } from './booking-status';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly coupons: CouponsService,
    private readonly availability: AvailabilityService,
    private readonly notifications: NotificationsService,
  ) {}

  async quote(dto: QuoteBookingDto) {
    const property = await this.requireApprovedProperty(dto.propertyId);
    this.assertStay(property.guestCapacity, dto);
    const coupon = await this.resolveCoupon(dto.couponCode, dto);
    const breakdown = this.pricing.quote({
      property,
      checkIn: dto.checkInDate,
      checkOut: dto.checkOutDate,
      guestCount: dto.guestCount,
      coupon,
    });
    await this.availability.assertRangeAvailable(
      dto.propertyId,
      dto.checkInDate,
      dto.checkOutDate,
    );
    return breakdown;
  }

  async create(user: RequestUser, dto: CreateBookingDto) {
    if (user.role !== UserRoles.CUSTOMER && user.role !== UserRoles.ADMIN) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Only customers can create bookings.',
      });
    }

    const property = await this.requireApprovedProperty(dto.propertyId);
    this.assertStay(property.guestCapacity, dto);
    const coupon = await this.resolveCoupon(dto.couponCode, dto);
    const breakdown = this.pricing.quote({
      property,
      checkIn: dto.checkInDate,
      checkOut: dto.checkOutDate,
      guestCount: dto.guestCount,
      coupon,
    });

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        await this.availability.assertRangeAvailable(
          dto.propertyId,
          dto.checkInDate,
          dto.checkOutDate,
          tx,
        );

        const nights = enumerateNights(dto.checkInDate, dto.checkOutDate);
        const created = await tx.booking.create({
          data: {
            customerId: user.id,
            propertyId: dto.propertyId,
            couponId: coupon?.id,
            checkInDate: toUtcDateOnly(dto.checkInDate),
            checkOutDate: toUtcDateOnly(dto.checkOutDate),
            guestCount: dto.guestCount,
            baseAmount: breakdown.baseAmount,
            weekendAmount: breakdown.weekendAmount,
            extraGuestAmount: breakdown.extraGuestAmount,
            platformFee: breakdown.platformFee,
            discountAmount: breakdown.discountAmount,
            totalAmount: breakdown.totalAmount,
            status: BookingStatus.PENDING,
            nights: {
              create: nights.map((date) => ({
                propertyId: dto.propertyId,
                date,
              })),
            },
          },
        });

        if (coupon) {
          await this.coupons.incrementRedemption(tx, coupon.id);
        }

        return created;
      });

      await this.notifications.notify({
        userId: user.id,
        type: NotificationTypes.BOOKING_CREATED,
        title: 'Booking created',
        body: `Your booking for ${property.title} is awaiting payment.`,
        metadata: { bookingId: booking.id },
      });
      await this.notifications.notify({
        userId: property.ownerId,
        type: NotificationTypes.BOOKING_CREATED,
        title: 'New booking',
        body: `A customer started a booking for ${property.title}.`,
        metadata: { bookingId: booking.id },
      });

      return { booking, pricing: breakdown };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          errorCode: ErrorCodes.DATES_UNAVAILABLE,
          message: 'Those dates were just booked. Please choose other dates.',
        });
      }
      throw error;
    }
  }

  async getById(id: string, user: RequestUser) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, title: true, ownerId: true } },
        payments: true,
        nights: true,
      },
    });
    if (!booking) {
      throw new NotFoundException({
        errorCode: ErrorCodes.BOOKING_NOT_FOUND,
        message: 'Booking not found.',
      });
    }
    this.assertCanView(booking, user);
    return booking;
  }

  async listMine(user: RequestUser, page: number, limit: number) {
    const where = user.role === UserRoles.ADMIN ? {} : { customerId: user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: {
          property: { select: { id: true, title: true, city: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async cancel(
    id: string,
    user: RequestUser,
    dto: CancelBookingDto,
    refundHandler?: (bookingId: string, reason?: string) => Promise<unknown>,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { nights: true, property: true },
    });
    if (!booking) {
      throw new NotFoundException({
        errorCode: ErrorCodes.BOOKING_NOT_FOUND,
        message: 'Booking not found.',
      });
    }

    const isOwner = booking.property.ownerId === user.id;
    const isCustomer = booking.customerId === user.id;
    const isAdmin = user.role === UserRoles.ADMIN;
    if (!isCustomer && !isOwner && !isAdmin) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'You cannot cancel this booking.',
      });
    }
    if (!canCustomerCancel(booking.status)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.INVALID_STATUS_TRANSITION,
        message: 'This booking cannot be cancelled.',
      });
    }

    const next =
      booking.status === BookingStatus.CONFIRMED
        ? BookingStatus.CANCELLED
        : BookingStatus.CANCELLED;
    assertBookingTransition(booking.status, next);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.bookingNight.deleteMany({ where: { bookingId: id } });
      await this.availability.releaseBooked(
        tx as unknown as PrismaService,
        booking.propertyId,
        booking.nights.map((night) => night.date),
      );
      if (booking.couponId && booking.status !== BookingStatus.CONFIRMED) {
        await this.coupons.decrementRedemption(tx, booking.couponId);
      }
      return tx.booking.update({
        where: { id },
        data: { status: next, cancelledAt: new Date() },
      });
    });

    let refund = null;
    if (booking.status === BookingStatus.CONFIRMED && refundHandler) {
      refund = await refundHandler(booking.id, dto.reason);
    }

    await this.notifications.notify({
      userId: booking.customerId,
      type: NotificationTypes.BOOKING_CANCELLED,
      title: 'Booking cancelled',
      body: `Your booking for ${booking.property.title} was cancelled.`,
      metadata: { bookingId: booking.id, reason: dto.reason },
    });
    await this.notifications.notify({
      userId: booking.property.ownerId,
      type: NotificationTypes.BOOKING_CANCELLED,
      title: 'Booking cancelled',
      body: `A booking for ${booking.property.title} was cancelled.`,
      metadata: { bookingId: booking.id },
    });

    return { booking: updated, refund };
  }

  async complete(id: string, user: RequestUser) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { property: true },
    });
    if (!booking) {
      throw new NotFoundException({
        errorCode: ErrorCodes.BOOKING_NOT_FOUND,
        message: 'Booking not found.',
      });
    }

    const isOwner = booking.property.ownerId === user.id;
    if (!isOwner && user.role !== UserRoles.ADMIN) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Only the property owner can complete this booking.',
      });
    }

    if (toUtcDateOnly(new Date()) < toUtcDateOnly(booking.checkOutDate)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.BOOKING_NOT_COMPLETABLE,
        message: 'A booking can only be completed after check-out.',
      });
    }

    assertBookingTransition(booking.status, BookingStatus.COMPLETED);

    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
    });
  }

  private assertCanView(
    booking: { customerId: string; property: { ownerId: string } },
    user: RequestUser,
  ) {
    if (
      user.role !== UserRoles.ADMIN &&
      booking.customerId !== user.id &&
      booking.property.ownerId !== user.id
    ) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'You cannot view this booking.',
      });
    }
  }

  private assertStay(
    guestCapacity: number,
    dto: { checkInDate: string; checkOutDate: string; guestCount: number },
  ) {
    if (!datesAreValidRange(dto.checkInDate, dto.checkOutDate)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.INVALID_DATE_RANGE,
        message: 'Check-out must be after check-in.',
      });
    }
    if (dto.guestCount > guestCapacity) {
      throw new BadRequestException({
        errorCode: ErrorCodes.GUEST_CAPACITY_EXCEEDED,
        message: 'Guest count exceeds property capacity.',
      });
    }
  }

  private async requireApprovedProperty(propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) {
      throw new NotFoundException({
        errorCode: ErrorCodes.PROPERTY_NOT_FOUND,
        message: 'Property not found.',
      });
    }
    if (property.status !== PropertyStatus.APPROVED) {
      throw new BadRequestException({
        errorCode: ErrorCodes.PROPERTY_NOT_APPROVED,
        message: 'This property is not available for booking.',
      });
    }
    return property;
  }

  private async resolveCoupon(code: string | undefined, dto: QuoteBookingDto) {
    if (!code) {
      return null;
    }
    const coupon = await this.coupons.getActiveByCode(code);
    if (!coupon) {
      throw new BadRequestException({
        errorCode: ErrorCodes.COUPON_INVALID,
        message: 'Coupon code is not valid.',
      });
    }
    const property = await this.requireApprovedProperty(dto.propertyId);
    const preview = this.pricing.quote({
      property,
      checkIn: dto.checkInDate,
      checkOut: dto.checkOutDate,
      guestCount: dto.guestCount,
    });
    const subtotal = money(preview.baseAmount)
      .plus(preview.weekendAmount)
      .plus(preview.extraGuestAmount)
      .toFixed(2);
    this.coupons.assertValid(coupon, subtotal);
    return coupon;
  }
}
