import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { paginated } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { money } from '../../common/money';

@Injectable()
export class OwnerService {
  constructor(private readonly prisma: PrismaService) {}

  properties(ownerId: string, page: number, limit: number) {
    return this.page(
      this.prisma.property.findMany({
        where: { ownerId },
        include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.property.count({ where: { ownerId } }),
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
