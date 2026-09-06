import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ErrorCodes } from '../../common/constants/error-codes';
import { paginated } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { money } from '../../common/money';
import { occupancyRate } from './owner-metrics';
import { toUtcDateOnly } from '../../common/dates';

@Injectable()
export class OwnerService {
  constructor(private readonly prisma: PrismaService) {}

  properties(ownerId: string, page: number, limit: number) {
    return this.page(
      this.prisma.property.findMany({
        where: { ownerId, deletedAt: null },
        include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.property.count({ where: { ownerId, deletedAt: null } }),
      page,
      limit,
    );
  }

  bookings(ownerId: string, page: number, limit: number) {
    const where = { property: { ownerId } };
    return this.page(
      this.prisma.booking.findMany({
        where,
        include: {
          property: { select: { id: true, title: true, status: true } },
          customer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
      page,
      limit,
    );
  }

  async earnings(ownerId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        property: { ownerId },
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
        },
      },
      select: { totalAmount: true, platformFee: true, status: true },
    });

    const gross = bookings.reduce(
      (sum, booking) => sum.plus(booking.totalAmount),
      money(0),
    );
    const fees = bookings.reduce(
      (sum, booking) => sum.plus(booking.platformFee),
      money(0),
    );

    const properties = await this.prisma.property.groupBy({
      by: ['status'],
      where: { ownerId },
      _count: { _all: true },
    });

    return {
      bookingCount: bookings.length,
      grossAmount: money(gross).toFixed(2),
      platformFees: money(fees).toFixed(2),
      netAmount: money(gross.minus(fees)).toFixed(2),
      propertyStatus: properties.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
    };
  }

  async overview(ownerId: string) {
    const today = toUtcDateOnly(new Date());
    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + 30);

    const [
      earnings,
      propertyCount,
      pendingApproval,
      upcoming,
      bookedNights,
      reviewAggregate,
      unreadNotifications,
    ] = await Promise.all([
      this.earnings(ownerId),
      this.prisma.property.count({ where: { ownerId, deletedAt: null } }),
      this.prisma.property.count({
        where: { ownerId, deletedAt: null, status: 'PENDING_APPROVAL' },
      }),
      this.prisma.booking.findMany({
        where: {
          property: { ownerId },
          status: BookingStatus.CONFIRMED,
          checkInDate: { gte: today },
        },
        include: { property: { select: { id: true, title: true } } },
        orderBy: { checkInDate: 'asc' },
        take: 5,
      }),
      this.prisma.bookingNight.count({
        where: {
          property: { ownerId, deletedAt: null },
          date: { gte: today, lt: horizon },
        },
      }),
      this.prisma.review.aggregate({
        where: { property: { ownerId, deletedAt: null } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.notification.count({
        where: { userId: ownerId, readAt: null },
      }),
    ]);

    return {
      ...earnings,
      propertyCount,
      pendingApproval,
      upcomingBookings: upcoming,
      occupancy: occupancyRate(bookedNights, propertyCount, 30),
      reviewCount: reviewAggregate._count._all,
      averageRating: reviewAggregate._avg.rating ?? 0,
      unreadNotifications,
    };
  }

  async reviews(ownerId: string, page: number, limit: number) {
    const where = { property: { ownerId, deletedAt: null } };
    return this.page(
      this.prisma.review.findMany({
        where,
        include: {
          property: { select: { id: true, title: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
      page,
      limit,
    );
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        ownerProfile: {
          select: {
            businessName: true,
            gstNumber: true,
            panNumber: true,
            kycVerified: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Owner profile not found.',
      });
    }
    return user;
  }

  async updateProfile(
    userId: string,
    dto: {
      name?: string;
      businessName?: string;
      gstNumber?: string;
      panNumber?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.name) {
        await tx.user.update({
          where: { id: userId },
          data: { name: dto.name.trim() },
        });
      }
      await tx.ownerProfile.upsert({
        where: { userId },
        update: {
          businessName: dto.businessName,
          gstNumber: dto.gstNumber,
          panNumber: dto.panNumber,
        },
        create: {
          userId,
          businessName: dto.businessName,
          gstNumber: dto.gstNumber,
          panNumber: dto.panNumber,
        },
      });
      return this.profile(userId);
    });
  }

  private async page<T>(
    itemsPromise: Promise<T[]>,
    countPromise: Promise<number>,
    page: number,
    limit: number,
  ) {
    const [items, total] = await Promise.all([itemsPromise, countPromise]);
    return paginated(items, total, page, limit);
  }
}
