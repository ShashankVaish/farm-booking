import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PropertyStatus, UserRole } from '@prisma/client';
import { ErrorCodes } from '../../common/constants/error-codes';
import { paginated } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotificationTypes,
  NotificationsService,
} from '../notifications/notifications.service';
import { CouponsService } from '../coupons/coupons.service';
import { CreateCouponDto } from '../coupons/dto/create-coupon.dto';
import { UpdateCouponDto } from '../coupons/dto/update-coupon.dto';
import {
  AdminBookingsQueryDto,
  AdminListQueryDto,
  AdminPropertiesQueryDto,
  AdminUsersQueryDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly coupons: CouponsService,
  ) {}

  async users(query: AdminUsersQueryDto) {
    const { page, limit } = this.page(query);
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { name: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  owners(query: AdminListQueryDto) {
    return this.users({ ...query, role: UserRole.OWNER });
  }

  async properties(query: AdminPropertiesQueryDto) {
    const { page, limit } = this.page(query);
    const where: Prisma.PropertyWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        include: { owner: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.property.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async setPropertyStatus(
    id: string,
    status: PropertyStatus,
    actorId: string,
    reason?: string,
  ) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) {
      throw new NotFoundException({
        errorCode: ErrorCodes.PROPERTY_NOT_FOUND,
        message: 'Property not found.',
      });
    }

    if (
      status === PropertyStatus.APPROVED &&
      property.status !== PropertyStatus.PENDING_APPROVAL &&
      property.status !== PropertyStatus.SUSPENDED &&
      property.status !== PropertyStatus.REJECTED
    ) {
      throw new BadRequestException({
        errorCode: ErrorCodes.INVALID_STATUS_TRANSITION,
        message: 'Property cannot be approved from its current status.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.property.update({
        where: { id },
        data: { status },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: `PROPERTY_${status}`,
          entityType: 'Property',
          entityId: id,
          metadata: reason ? { reason } : undefined,
        },
      });
      return next;
    });

    if (status === PropertyStatus.APPROVED) {
      await this.notifications.notify({
        userId: property.ownerId,
        type: NotificationTypes.PROPERTY_APPROVED,
        title: 'Property approved',
        body: `${property.title} is now live.`,
        metadata: { propertyId: id },
      });
    }
    if (status === PropertyStatus.REJECTED) {
      await this.notifications.notify({
        userId: property.ownerId,
        type: NotificationTypes.PROPERTY_REJECTED,
        title: 'Property rejected',
        body: reason || `${property.title} was rejected.`,
        metadata: { propertyId: id, reason },
      });
    }

    return updated;
  }

  async bookings(query: AdminBookingsQueryDto) {
    const { page, limit } = this.page(query);
    const where: Prisma.BookingWhereInput = query.status
      ? { status: query.status }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: {
          property: { select: { id: true, title: true } },
          customer: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async payments(query: AdminListQueryDto) {
    const { page, limit } = this.page(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        include: { booking: { select: { id: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count(),
    ]);
    return paginated(items, total, page, limit);
  }

  async tickets(query: AdminListQueryDto) {
    const { page, limit } = this.page(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supportTicket.count(),
    ]);
    return paginated(items, total, page, limit);
  }

  listCoupons(query: AdminListQueryDto) {
    const { page, limit } = this.page(query);
    return this.coupons.list(page, limit);
  }

  createCoupon(dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  updateCoupon(id: string, dto: UpdateCouponDto) {
    return this.coupons.update(id, dto);
  }

  deleteCoupon(id: string) {
    return this.coupons.remove(id);
  }

  private page(query: AdminListQueryDto) {
    return {
      page: query.page ?? 1,
      limit: Math.min(query.limit ?? 20, 100),
    };
  }
}
