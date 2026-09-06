import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AvailabilityStatus } from '@prisma/client';
import { ErrorCodes } from '../../common/constants/error-codes';
import {
  enumerateNights,
  isDateInPast,
  toUtcDateOnly,
} from '../../common/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import type { RequestUser } from '../auth/auth.types';
import { BlockDatesDto } from './dto/availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly properties: PropertiesService,
  ) {}

  async getCalendar(propertyId: string, from: string, to: string) {
    if (toUtcDateOnly(from) >= toUtcDateOnly(to)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.INVALID_DATE_RANGE,
        message: 'from must be before to.',
      });
    }

    const nights = enumerateNights(from, to);
    const [overrides, booked] = await Promise.all([
      this.prisma.availability.findMany({
        where: {
          propertyId,
          date: { gte: nights[0], lte: nights[nights.length - 1] },
        },
      }),
      this.prisma.bookingNight.findMany({
        where: {
          propertyId,
          date: { gte: nights[0], lte: nights[nights.length - 1] },
        },
        select: { date: true },
      }),
    ]);

    const overrideMap = new Map(
      overrides.map((row) => [row.date.toISOString().slice(0, 10), row]),
    );
    const bookedSet = new Set(
      booked.map((row) => row.date.toISOString().slice(0, 10)),
    );

    return nights.map((date) => {
      const key = date.toISOString().slice(0, 10);
      if (bookedSet.has(key)) {
        return { date: key, status: AvailabilityStatus.BOOKED };
      }
      const override = overrideMap.get(key);
      return {
        date: key,
        status: override?.status ?? AvailabilityStatus.AVAILABLE,
        notes: override?.notes ?? null,
      };
    });
  }

  async assertRangeAvailable(
    propertyId: string,
    checkIn: string | Date,
    checkOut: string | Date,
    tx: Pick<PrismaService, 'availability' | 'bookingNight'> = this.prisma,
    excludeBookingId?: string,
  ): Promise<Date[]> {
    const nights = enumerateNights(checkIn, checkOut);
    if (nights.length === 0) {
      throw new BadRequestException({
        errorCode: ErrorCodes.INVALID_DATE_RANGE,
        message: 'Check-out must be after check-in.',
      });
    }
    if (isDateInPast(checkIn)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.INVALID_DATE_RANGE,
        message: 'Cannot book dates in the past.',
      });
    }

    const [blocked, booked] = await Promise.all([
      tx.availability.findMany({
        where: {
          propertyId,
          date: { in: nights },
          status: {
            in: [AvailabilityStatus.BLOCKED, AvailabilityStatus.BOOKED],
          },
        },
        select: { date: true },
      }),
      tx.bookingNight.findMany({
        where: {
          propertyId,
          date: { in: nights },
          ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
        },
        select: { date: true },
      }),
    ]);

    if (blocked.length > 0 || booked.length > 0) {
      throw new ConflictException({
        errorCode: ErrorCodes.DATES_UNAVAILABLE,
        message: 'One or more dates are not available.',
      });
    }

    return nights;
  }

  async block(propertyId: string, user: RequestUser, dto: BlockDatesDto) {
    await this.properties.requireManaged(propertyId, user);
    const dates = dto.dates.map((value) => toUtcDateOnly(value));
    if (dates.some((date) => isDateInPast(date))) {
      throw new BadRequestException({
        errorCode: ErrorCodes.INVALID_DATE_RANGE,
        message: 'Cannot block dates in the past.',
      });
    }

    const booked = await this.prisma.bookingNight.findMany({
      where: { propertyId, date: { in: dates } },
    });
    if (booked.length > 0) {
      throw new ConflictException({
        errorCode: ErrorCodes.DATES_UNAVAILABLE,
        message: 'Cannot block dates that are already booked.',
      });
    }

    await this.prisma.$transaction(
      dates.map((date) =>
        this.prisma.availability.upsert({
          where: { propertyId_date: { propertyId, date } },
          update: { status: AvailabilityStatus.BLOCKED, notes: dto.notes },
          create: {
            propertyId,
            date,
            status: AvailabilityStatus.BLOCKED,
            notes: dto.notes,
          },
        }),
      ),
    );

    return { blocked: dates.length };
  }

  async unblock(propertyId: string, user: RequestUser, dto: BlockDatesDto) {
    await this.properties.requireManaged(propertyId, user);
    const dates = dto.dates.map((value) => toUtcDateOnly(value));

    await this.prisma.availability.updateMany({
      where: {
        propertyId,
        date: { in: dates },
        status: AvailabilityStatus.BLOCKED,
      },
      data: { status: AvailabilityStatus.AVAILABLE, notes: dto.notes },
    });

    return { unblocked: dates.length };
  }

  async markBooked(
    tx: PrismaService,
    propertyId: string,
    dates: Date[],
  ): Promise<void> {
    for (const date of dates) {
      await tx.availability.upsert({
        where: { propertyId_date: { propertyId, date } },
        update: { status: AvailabilityStatus.BOOKED },
        create: {
          propertyId,
          date,
          status: AvailabilityStatus.BOOKED,
        },
      });
    }
  }

  async releaseBooked(
    tx: PrismaService,
    propertyId: string,
    dates: Date[],
  ): Promise<void> {
    await tx.availability.updateMany({
      where: {
        propertyId,
        date: { in: dates },
        status: AvailabilityStatus.BOOKED,
      },
      data: { status: AvailabilityStatus.AVAILABLE },
    });
  }
}
