import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { paginated } from '../../common/pagination';
import {
  CouponValidationError,
  validateCouponRules,
} from './coupon-validation';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveByCode(code: string) {
    return this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
  }

  assertValid(
    coupon: NonNullable<Awaited<ReturnType<CouponsService['getActiveByCode']>>>,
    subtotal: string,
    now = new Date(),
  ): void {
    try {
      validateCouponRules(coupon, subtotal, now);
    } catch (error) {
      if (error instanceof CouponValidationError) {
        throw new BadRequestException({
          errorCode: error.errorCode,
          message: error.message,
        });
      }
      throw error;
    }
  }

  async incrementRedemption(
    tx: Prisma.TransactionClient,
    couponId: string,
  ): Promise<void> {
    const updated = await tx.$executeRaw`
      UPDATE "Coupon"
      SET "redemptionCount" = "redemptionCount" + 1,
          "updatedAt" = NOW()
      WHERE "id" = ${couponId}
        AND "isActive" = true
        AND ("maxRedemptions" IS NULL OR "redemptionCount" < "maxRedemptions")
    `;

    if (updated !== 1) {
      throw new BadRequestException({
        errorCode: ErrorCodes.COUPON_LIMIT_REACHED,
        message: 'This coupon has reached its redemption limit.',
      });
    }
  }

  async decrementRedemption(
    tx: Prisma.TransactionClient,
    couponId: string,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE "Coupon"
      SET "redemptionCount" = GREATEST("redemptionCount" - 1, 0),
          "updatedAt" = NOW()
      WHERE "id" = ${couponId}
    `;
  }

  async list(page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.coupon.count(),
    ]);
    return paginated(items, total, page, limit);
  }

  async create(dto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscount: dto.maxDiscount,
        minBookingAmount: dto.minBookingAmount,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        maxRedemptions: dto.maxRedemptions,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCouponDto) {
    await this.ensureExists(id);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.coupon.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Coupon not found.',
      });
    }
  }
}
