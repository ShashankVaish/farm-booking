import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ErrorCodes } from '../../common/constants/error-codes';
import { paginated } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit.service';
import { UserRoles } from '../../common/constants/roles';
import { money } from '../../common/money';
import { occupancyRate } from './owner-metrics';
import { toUtcDateOnly } from '../../common/dates';

@Injectable()
export class OwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  /**
   * Turns an ordinary guest into a host.
   *
   * Hosting is an addition to an account, not a different kind of account: the
   * same person books stays and lets their own place out, so this upgrades the
   * role in place rather than asking them to register again. An OWNER can still
   * book — see bookings.service — so nothing is lost by accepting.
   *
   * Idempotent: calling it again on an existing host is a no-op, which matters
   * because the button that calls it can be double-tapped.
   */
  async becomeHost(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Account not found.',
      });
    }

    // An admin keeps its own role; downgrading it to OWNER would silently strip
    // the moderation powers the account exists for.
    if (user.role === UserRoles.ADMIN) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Admin accounts cannot be converted into host accounts.',
      });
    }

    const upgraded = await this.prisma.$transaction(async (tx) => {
      const next =
        user.role === UserRoles.OWNER
          ? user
          : await tx.user.update({
              where: { id: userId },
              data: { role: UserRoles.OWNER },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
              },
            });

      // The profile carries KYC and payout details. It must exist before the
      // listing wizard's verification step can save anything into it.
      await tx.ownerProfile.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });

      return next;
    });

    await this.audit.record({
      actorId: userId,
      action: 'HOST_ACCOUNT_ENABLED',
      entityType: 'User',
      entityId: userId,
      metadata: { previousRole: user.role },
    });

    return {
      id: upgraded.id,
      email: upgraded.email,
      name: upgraded.name,
      role: upgraded.role,
      alreadyHost: user.role === UserRoles.OWNER,
    };
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
