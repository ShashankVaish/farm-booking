import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { ErrorCodes } from '../../common/constants/error-codes';
import { UserRoles } from '../../common/constants/roles';
import { paginated } from '../../common/pagination';
import { isUuid } from '../../common/uuid';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../auth/auth.types';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(propertyId: string, user: RequestUser, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });
    if (!booking || booking.propertyId !== propertyId) {
      throw new BadRequestException({
        errorCode: ErrorCodes.REVIEW_NOT_ALLOWED,
        message: 'The booking does not belong to this property.',
      });
    }
    if (booking.customerId !== user.id) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'You can only review your own stay.',
      });
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException({
        errorCode: ErrorCodes.REVIEW_NOT_ALLOWED,
        message: 'You can only review a completed booking.',
      });
    }

    try {
      const review = await this.prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: {
            bookingId: booking.id,
            propertyId,
            customerId: user.id,
            rating: dto.rating,
            comment: dto.comment,
          },
        });
        await this.recalculateRating(tx, propertyId);
        return created;
      });
      return review;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException({
          errorCode: ErrorCodes.REVIEW_NOT_ALLOWED,
          message: 'This booking already has a review.',
        });
      }
      throw error;
    }
  }

  async list(propertyId: string, page: number, limit: number) {
    const property = await this.prisma.property.findFirst({
      where: isUuid(propertyId)
        ? { OR: [{ id: propertyId }, { slug: propertyId }] }
        : { slug: propertyId },
      select: { id: true },
    });
    if (!property) {
      return paginated([], 0, page, limit);
    }
    const where = { propertyId: property.id, isPublished: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async update(id: string, user: RequestUser, dto: UpdateReviewDto) {
    const review = await this.requireOwned(id, user);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.review.update({
        where: { id },
        data: dto,
      });
      await this.recalculateRating(tx, review.propertyId);
      return next;
    });
    return updated;
  }

  async moderate(id: string, isPublished: boolean) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Review not found.',
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.review.update({
        where: { id },
        data: { isPublished },
      });
      await this.recalculateRating(tx, review.propertyId);
      return next;
    });
    return updated;
  }

  async remove(id: string, user: RequestUser) {
    const review = await this.requireOwned(id, user);
    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      await this.recalculateRating(tx, review.propertyId);
    });
    return { deleted: true };
  }

  private async requireOwned(id: string, user: RequestUser) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Review not found.',
      });
    }
    if (review.customerId !== user.id && user.role !== UserRoles.ADMIN) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'You cannot modify this review.',
      });
    }
    return review;
  }

  private async recalculateRating(
    tx: Prisma.TransactionClient,
    propertyId: string,
  ) {
    const aggregate = await tx.review.aggregate({
      where: { propertyId, isPublished: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.property.update({
      where: { id: propertyId },
      data: {
        averageRating: aggregate._avg.rating ?? 0,
        reviewCount: aggregate._count._all,
      },
    });
  }
}
