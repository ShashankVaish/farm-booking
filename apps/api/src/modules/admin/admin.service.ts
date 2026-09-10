import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AvailabilityStatus,
  BookingStatus,
  PaymentStatus,
  Prisma,
  PropertyStatus,
  RefundStatus,
  SupportTicketStatus,
  UserRole,
} from '@prisma/client';
import { AuditActions, AuditService } from '../../common/audit.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { toUtcDateOnly } from '../../common/dates';
import { money } from '../../common/money';
import { paginated } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotificationTypes,
  NotificationsService,
} from '../notifications/notifications.service';
import { occupancyRate } from '../owner/owner-metrics';
import { PaymentsService } from '../payments/payments.service';
import { PricingService } from '../pricing/pricing.service';
import { ReviewsService } from '../reviews/reviews.service';
import { BookingsService } from '../bookings/bookings.service';
import {
  EDITABLE_SETTINGS,
  PlatformSettingsService,
  type EditableSettingKey,
} from '../settings/platform-settings.service';
import { CouponsService } from '../coupons/coupons.service';
import { CreateCouponDto } from '../coupons/dto/create-coupon.dto';
import { UpdateCouponDto } from '../coupons/dto/update-coupon.dto';
import { presentAdminPayment } from './admin-presenters';
import {
  AdminBookingsQueryDto,
  AdminListQueryDto,
  AdminPaymentsQueryDto,
  AdminPropertiesQueryDto,
  AdminReportsQueryDto,
  AdminUsersQueryDto,
} from './dto/admin.dto';

const REVENUE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];

const PENDING_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.CREATED,
  PaymentStatus.PENDING,
  PaymentStatus.PROCESSING,
];

const PAYMENT_SELECT = {
  id: true,
  bookingId: true,
  provider: true,
  providerPaymentId: true,
  providerOrderId: true,
  amount: true,
  currency: true,
  status: true,
  verifiedAt: true,
  expiresAt: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly coupons: CouponsService,
    private readonly paymentsService: PaymentsService,
    private readonly reviewsService: ReviewsService,
    private readonly audit: AuditService,
    private readonly pricing: PricingService,
    private readonly config: ConfigService,
    private readonly bookingsService: BookingsService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async overview() {
    const now = new Date();
    const today = toUtcDateOnly(now);
    const occupancyWindowDays = 30;
    const occupancyFrom = new Date(today);
    occupancyFrom.setUTCDate(occupancyFrom.getUTCDate() - occupancyWindowDays);

    const [
      totalBookings,
      todaysBookings,
      revenueAgg,
      pendingPayments,
      refunds,
      users,
      owners,
      properties,
      approvedProperties,
      bookedNights,
      recentActivity,
    ] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { createdAt: { gte: today } } }),
      this.prisma.booking.aggregate({
        where: { status: { in: REVENUE_STATUSES } },
        _sum: { totalAmount: true, platformFee: true },
      }),
      this.prisma.payment.count({
        where: { status: { in: PENDING_PAYMENT_STATUSES } },
      }),
      this.prisma.refund.count(),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.OWNER } }),
      this.prisma.property.count({ where: { deletedAt: null } }),
      this.prisma.property.count({
        where: { deletedAt: null, status: PropertyStatus.APPROVED },
      }),
      this.prisma.bookingNight.count({
        where: {
          date: { gte: occupancyFrom, lt: today },
          booking: { status: { in: REVENUE_STATUSES } },
        },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return {
      totalBookings,
      todaysBookings,
      revenue: money(revenueAgg._sum.totalAmount ?? 0).toFixed(2),
      platformCommission: money(revenueAgg._sum.platformFee ?? 0).toFixed(2),
      pendingPayments,
      refunds,
      users,
      owners,
      properties,
      occupancy: occupancyRate(
        bookedNights,
        approvedProperties,
        occupancyWindowDays,
      ),
      recentActivity,
    };
  }

  async reports(query: AdminReportsQueryDto) {
    const to = query.to ? toUtcDateOnly(query.to) : toUtcDateOnly(new Date());
    const from = query.from
      ? toUtcDateOnly(query.from)
      : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    const rangeEnd = new Date(to);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

    const createdInRange = { gte: from, lt: rangeEnd };

    const [bookingGroups, revenueAgg, refundAgg, newUsers, newProperties] =
      await Promise.all([
        this.prisma.booking.groupBy({
          by: ['status'],
          where: { createdAt: createdInRange },
          _count: { _all: true },
        }),
        this.prisma.booking.aggregate({
          where: {
            status: { in: REVENUE_STATUSES },
            createdAt: createdInRange,
          },
          _sum: { totalAmount: true, platformFee: true },
          _count: { _all: true },
        }),
        this.prisma.refund.aggregate({
          where: {
            status: RefundStatus.COMPLETED,
            createdAt: createdInRange,
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        this.prisma.user.count({ where: { createdAt: createdInRange } }),
        this.prisma.property.count({
          where: { createdAt: createdInRange, deletedAt: null },
        }),
      ]);

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      bookings: bookingGroups.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      confirmedBookings: revenueAgg._count._all,
      revenue: money(revenueAgg._sum.totalAmount ?? 0).toFixed(2),
      platformCommission: money(revenueAgg._sum.platformFee ?? 0).toFixed(2),
      completedRefunds: refundAgg._count._all,
      refundedAmount: money(refundAgg._sum.amount ?? 0).toFixed(2),
      newUsers,
      newProperties,
    };
  }

  settings() {
    const feeBps = this.pricing.platformFeeBps();
    const razorpayKey = this.config.get<string>('RAZORPAY_KEY_ID');
    return {
      platformFeeBps: feeBps,
      platformFeePercent: feeBps / 100,
      bookingExpireMinutes: this.platformSettings.getNumber('BOOKING_EXPIRE_MINUTES'),
      paymentProvider: 'RAZORPAY',
      razorpayConfigured: Boolean(razorpayKey),
      smsProvider: (this.config.get<string>('SMS_PROVIDER') ?? 'console').toLowerCase(),
      smsConfigured: this.smsConfigured(),
      environment: this.config.get<string>('NODE_ENV'),
    };
  }

  /** True when the selected SMS gateway has the credentials it needs. */
  private smsConfigured(): boolean {
    const provider = (this.config.get<string>('SMS_PROVIDER') ?? 'console').toLowerCase();
    if (provider === 'renflair') {
      return Boolean(this.config.get<string>('RENFLAIR_API_KEY'));
    }
    if (provider === 'twilio') {
      return Boolean(
        this.config.get<string>('TWILIO_ACCOUNT_SID') &&
          this.config.get<string>('TWILIO_AUTH_TOKEN') &&
          this.config.get<string>('TWILIO_FROM_NUMBER'),
      );
    }
    // The console provider needs nothing, but it never actually sends.
    return true;
  }

  async users(query: AdminUsersQueryDto) {
    const { page, limit } = this.page(query);
    const registeredToExclusive = query.registeredTo
      ? (() => {
          const end = toUtcDateOnly(query.registeredTo);
          end.setUTCDate(end.getUTCDate() + 1);
          return end;
        })()
      : undefined;
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status === 'ACTIVE' ? { isActive: true } : {}),
      ...(query.status === 'DISABLED' ? { isActive: false } : {}),
      ...(query.registeredFrom || registeredToExclusive
        ? {
            createdAt: {
              ...(query.registeredFrom
                ? { gte: toUtcDateOnly(query.registeredFrom) }
                : {}),
              ...(registeredToExclusive ? { lt: registeredToExclusive } : {}),
            },
          }
        : {}),
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

  owners(query: AdminUsersQueryDto) {
    return this.users({ ...query, role: UserRole.OWNER });
  }

  async properties(query: AdminPropertiesQueryDto) {
    const { page, limit } = this.page(query);
    const where: Prisma.PropertyWhereInput = {
      deletedAt: null,
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

  /**
   * Everything a reviewer needs on one screen: the full listing as submitted,
   * who owns it and whether their KYC is done, and the moderation history so a
   * resubmitted listing can be checked against what was asked for last time.
   */
  async property(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            phoneVerifiedAt: true,
            role: true,
            isActive: true,
            createdAt: true,
            ownerProfile: {
              select: {
                businessName: true,
                gstNumber: true,
                panNumber: true,
                panImageUrl: true,
                aadhaarLast4: true,
                aadhaarImageUrl: true,
                kycStatus: true,
                kycSubmittedAt: true,
                kycRejectionReason: true,
                kycVerified: true,
              },
            },
          },
        },
        images: { orderBy: { sortOrder: 'asc' } },
        amenities: { include: { amenity: { select: { id: true, name: true, slug: true } } } },
        documents: true,
        _count: { select: { bookings: true, reviews: true } },
      },
    });

    if (!property || property.deletedAt) {
      throw new NotFoundException({
        errorCode: ErrorCodes.PROPERTY_NOT_FOUND,
        message: 'Property not found.',
      });
    }

    const [otherListings, auditTrail] = await Promise.all([
      this.prisma.property.count({
        where: { ownerId: property.ownerId, deletedAt: null, NOT: { id } },
      }),
      this.prisma.auditLog.findMany({
        where: { entityType: 'Property', entityId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          action: true,
          metadata: true,
          createdAt: true,
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return {
      id: property.id,
      status: property.status,
      title: property.title,
      slug: property.slug,
      description: property.description,
      propertyType: property.propertyType,
      isPartyFriendly: property.isPartyFriendly,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
      location: {
        location: property.location,
        address: property.address,
        city: property.city,
        state: property.state,
        country: property.country,
        pincode: property.pincode,
        latitude: Number(property.latitude),
        longitude: Number(property.longitude),
      },
      capacity: {
        guests: property.guestCapacity,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
      },
      pricing: {
        basePrice: money(property.basePrice).toFixed(2),
        weekendPrice: property.weekendPrice
          ? money(property.weekendPrice).toFixed(2)
          : null,
        extraGuestCharge: property.extraGuestCharge
          ? money(property.extraGuestCharge).toFixed(2)
          : null,
      },
      rules: {
        propertyRules: property.propertyRules,
        partyRules: property.partyRules,
        cancellationPolicy: property.cancellationPolicy,
      },
      images: property.images.map((image) => ({
        id: image.id,
        url: image.url,
        altText: image.altText,
        isCover: image.isCover,
        sortOrder: image.sortOrder,
      })),
      amenities: property.amenities
        .map((row) => row.amenity)
        .filter((amenity): amenity is NonNullable<typeof amenity> => Boolean(amenity)),
      documents: property.documents.map((document) => ({
        id: document.id,
        name: document.name,
        documentType: document.documentType,
        url: document.url,
        status: document.status,
        createdAt: document.createdAt,
      })),
      owner: {
        id: property.owner.id,
        name: property.owner.name,
        email: property.owner.email,
        phone: property.owner.phone,
        phoneVerified: Boolean(property.owner.phoneVerifiedAt),
        isActive: property.owner.isActive,
        memberSince: property.owner.createdAt,
        otherListings,
        profile: property.owner.ownerProfile,
      },
      stats: {
        bookings: property._count.bookings,
        reviews: property._count.reviews,
        averageRating: Number(property.averageRating),
      },
      auditTrail,
    };
  }

  approveProperty(id: string, actorId: string) {
    return this.setPropertyStatus(id, PropertyStatus.APPROVED, actorId);
  }

  rejectProperty(id: string, actorId: string, reason: string) {
    return this.setPropertyStatus(
      id,
      PropertyStatus.REJECTED,
      actorId,
      reason,
    );
  }

  requestPropertyChanges(id: string, actorId: string, reason: string) {
    return this.setPropertyStatus(
      id,
      PropertyStatus.CHANGES_REQUESTED,
      actorId,
      reason,
    );
  }

  suspendProperty(id: string, actorId: string, reason: string) {
    return this.setPropertyStatus(
      id,
      PropertyStatus.SUSPENDED,
      actorId,
      reason,
    );
  }

  restoreProperty(id: string, actorId: string) {
    return this.setPropertyStatus(id, PropertyStatus.APPROVED, actorId, undefined, true);
  }

  async setPropertyStatus(
    id: string,
    status: PropertyStatus,
    actorId: string,
    reason?: string,
    restore = false,
  ) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) {
      throw new NotFoundException({
        errorCode: ErrorCodes.PROPERTY_NOT_FOUND,
        message: 'Property not found.',
      });
    }

    this.assertAdminPropertyTransition(property.status, status, restore);

    if (
      (status === PropertyStatus.REJECTED ||
        status === PropertyStatus.CHANGES_REQUESTED ||
        status === PropertyStatus.SUSPENDED) &&
      !reason?.trim()
    ) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'A reason is required for this action.',
      });
    }

    const action = restore
      ? AuditActions.PROPERTY_RESTORED
      : `PROPERTY_${status}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.property.update({
        where: { id },
        data: { status },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action,
          entityType: 'Property',
          entityId: id,
          metadata: reason ? { reason } : undefined,
        },
      });
      return next;
    });

    if (status === PropertyStatus.APPROVED) {
      await this.notificationsService.notify({
        userId: property.ownerId,
        type: NotificationTypes.PROPERTY_APPROVED,
        title: restore ? 'Property restored' : 'Property approved',
        body: restore
          ? `${property.title} is live again.`
          : `${property.title} is now live.`,
        metadata: { propertyId: id },
        dedupeKey: `PROPERTY_APPROVED:${id}`,
      });
    }
    if (status === PropertyStatus.REJECTED) {
      await this.notificationsService.notify({
        userId: property.ownerId,
        type: NotificationTypes.PROPERTY_REJECTED,
        title: 'Property rejected',
        body: reason || `${property.title} was rejected.`,
        metadata: { propertyId: id, reason },
      });
    }
    if (status === PropertyStatus.CHANGES_REQUESTED) {
      await this.notificationsService.notify({
        userId: property.ownerId,
        type: NotificationTypes.PROPERTY_CHANGES_REQUESTED,
        title: 'Changes requested',
        body: reason || `Please update ${property.title} and resubmit.`,
        metadata: { propertyId: id, reason },
      });
    }
    if (status === PropertyStatus.SUSPENDED) {
      await this.notificationsService.notify({
        userId: property.ownerId,
        type: NotificationTypes.PROPERTY_SUSPENDED,
        title: 'Property suspended',
        body: reason || `${property.title} was suspended.`,
        metadata: { propertyId: id, reason },
      });
    }

    return updated;
  }

  async bookings(query: AdminBookingsQueryDto) {
    const { page, limit } = this.page(query);
    const where: Prisma.BookingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { customer: { email: { contains: query.q, mode: 'insensitive' } } },
              { customer: { name: { contains: query.q, mode: 'insensitive' } } },
              { property: { title: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              title: true,
              owner: { select: { id: true, name: true, email: true } },
            },
          },
          customer: { select: { id: true, email: true, name: true } },
          payments: { select: PAYMENT_SELECT, orderBy: { createdAt: 'desc' } },
          refunds: {
            select: {
              id: true,
              amount: true,
              status: true,
              reason: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginated(
      items.map((booking) => this.presentBooking(booking)),
      total,
      page,
      limit,
    );
  }

  async booking(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            state: true,
            owner: { select: { id: true, name: true, email: true } },
          },
        },
        customer: { select: { id: true, email: true, name: true } },
        payments: { select: PAYMENT_SELECT, orderBy: { createdAt: 'desc' } },
        refunds: {
          select: {
            id: true,
            paymentId: true,
            amount: true,
            status: true,
            reason: true,
            providerRefundId: true,
            providerStatus: true,
            createdAt: true,
          },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException({
        errorCode: ErrorCodes.BOOKING_NOT_FOUND,
        message: 'Booking not found.',
      });
    }
    return this.presentBooking(booking);
  }

  async payments(query: AdminPaymentsQueryDto) {
    const { page, limit } = this.page(query);
    const since = query.hours
      ? new Date(Date.now() - query.hours * 60 * 60 * 1000)
      : undefined;
    const where: Prisma.PaymentWhereInput = {
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(query.q
        ? {
            OR: [
              { id: { contains: query.q, mode: 'insensitive' } },
              { providerPaymentId: { contains: query.q, mode: 'insensitive' } },
              { providerOrderId: { contains: query.q, mode: 'insensitive' } },
              { bookingId: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        select: {
          ...PAYMENT_SELECT,
          booking: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginated(items.map(presentAdminPayment), total, page, limit);
  }

  /**
   * Settings an admin may change from the panel. Everything else in the
   * settings payload is environment-derived and read-only.
   */
  async updateSettings(
    dto: { platformFeeBps?: number; bookingExpireMinutes?: number },
    actorId: string,
  ) {
    const updates: Array<[EditableSettingKey, number]> = [];
    if (dto.platformFeeBps !== undefined) {
      updates.push(['PLATFORM_FEE_BPS', dto.platformFeeBps]);
    }
    if (dto.bookingExpireMinutes !== undefined) {
      updates.push(['BOOKING_EXPIRE_MINUTES', dto.bookingExpireMinutes]);
    }
    if (updates.length === 0) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Nothing to update.',
      });
    }
    for (const [key, value] of updates) {
      await this.platformSettings.update(key, value, actorId);
    }
    return this.settings();
  }

  /**
   * Removes a payment row that never moved money.
   *
   * Captured, refunding and refunded payments are the record of real money and
   * are never deletable — losing one would break reconciliation against the
   * gateway and leave a booking that cannot be audited. Only abandoned attempts
   * (created, failed, cancelled, expired) can be cleared, and each removal is
   * written to the audit log first.
   */
  async deletePayment(id: string, actorId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { refunds: { select: { id: true } } },
    });
    if (!payment) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Payment not found.',
      });
    }

    const deletable: PaymentStatus[] = [
      PaymentStatus.CREATED,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
      PaymentStatus.EXPIRED,
    ];
    if (!deletable.includes(payment.status)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.FORBIDDEN,
        message:
          'Only failed, cancelled, expired or unstarted payments can be removed. A captured or refunded payment is a financial record and must be kept.',
      });
    }
    if (payment.refunds.length > 0) {
      throw new BadRequestException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'This payment has refunds attached and cannot be removed.',
      });
    }

    await this.audit.record({
      actorId,
      action: 'PAYMENT_DELETED',
      entityType: 'Payment',
      entityId: id,
      metadata: {
        bookingId: payment.bookingId,
        status: payment.status,
        amount: money(payment.amount).toFixed(2),
        providerOrderId: payment.providerOrderId,
        providerPaymentId: payment.providerPaymentId,
      },
    });
    await this.prisma.payment.delete({ where: { id } });

    return { deleted: true, id };
  }

  async tickets(query: AdminListQueryDto) {
    const { page, limit } = this.page(query);
    const where: Prisma.SupportTicketWhereInput = query.q
      ? {
          OR: [
            { subject: { contains: query.q, mode: 'insensitive' } },
            { user: { email: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async notifications(query: AdminListQueryDto) {
    const { page, limit } = this.page(query);
    const where: Prisma.NotificationWhereInput = query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { type: { contains: query.q, mode: 'insensitive' } },
            { user: { email: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          readAt: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  listCoupons(query: AdminListQueryDto) {
    const { page, limit } = this.page(query);
    return this.coupons.list(page, limit);
  }

  async createCoupon(dto: CreateCouponDto, actorId: string) {
    const coupon = await this.coupons.create(dto);
    await this.audit.record({
      actorId,
      action: AuditActions.COUPON_CREATED,
      entityType: 'Coupon',
      entityId: coupon.id,
      metadata: { code: coupon.code },
    });
    return coupon;
  }

  async updateCoupon(id: string, dto: UpdateCouponDto, actorId: string) {
    const coupon = await this.coupons.update(id, dto);
    await this.audit.record({
      actorId,
      action: AuditActions.COUPON_UPDATED,
      entityType: 'Coupon',
      entityId: id,
    });
    return coupon;
  }

  async deleteCoupon(id: string, actorId: string) {
    const result = await this.coupons.remove(id);
    await this.audit.record({
      actorId,
      action: AuditActions.COUPON_DELETED,
      entityType: 'Coupon',
      entityId: id,
    });
    return result;
  }

  async setUserActive(id: string, isActive: boolean, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'User not found.',
      });
    }
    if (user.id === actorId && !isActive) {
      throw new BadRequestException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Admins cannot disable their own account.',
      });
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });
    await this.audit.record({
      actorId,
      action: isActive ? AuditActions.USER_ENABLED : AuditActions.USER_DISABLED,
      entityType: 'User',
      entityId: id,
    });
    return updated;
  }

  async reviews(query: AdminListQueryDto) {
    const { page, limit } = this.page(query);
    const where: Prisma.ReviewWhereInput = query.q
      ? {
          OR: [
            { comment: { contains: query.q, mode: 'insensitive' } },
            { property: { title: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          property: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async moderateReview(id: string, isPublished: boolean, actorId: string) {
    const updated = await this.reviewsService.moderate(id, isPublished);
    await this.audit.record({
      actorId,
      action: AuditActions.REVIEW_MODERATED,
      entityType: 'Review',
      entityId: id,
      metadata: { isPublished },
    });
    return updated;
  }

  refunds(query: AdminListQueryDto) {
    const { page, limit } = this.page(query);
    return this.pageRefunds(page, limit);
  }

  private async pageRefunds(page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        select: {
          id: true,
          bookingId: true,
          paymentId: true,
          amount: true,
          reason: true,
          status: true,
          providerRefundId: true,
          providerStatus: true,
          createdAt: true,
          booking: { select: { id: true, status: true, totalAmount: true } },
          payment: {
            select: {
              id: true,
              status: true,
              amount: true,
              providerPaymentId: true,
              providerOrderId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.refund.count(),
    ]);
    return paginated(
      items.map((refund) => ({
        id: refund.id,
        bookingId: refund.bookingId,
        paymentId: refund.paymentId,
        amount: money(refund.amount).toFixed(2),
        reason: refund.reason,
        status: refund.status,
        gatewayRefundId: refund.providerRefundId,
        // What the gateway said. Without this a failed refund is a dead end.
        gatewayStatus: refund.providerStatus,
        createdAt: refund.createdAt,
        booking: refund.booking,
        payment: {
          id: refund.payment.id,
          status: refund.payment.status,
          amount: money(refund.payment.amount).toFixed(2),
          gatewayPaymentId: refund.payment.providerPaymentId,
          gatewayOrderId: refund.payment.providerOrderId,
        },
      })),
      total,
      page,
      limit,
    );
  }

  /**
   * Cancels a booking on the guest's behalf and refunds in one action.
   *
   * The refund goes back through the gateway to whatever the guest actually
   * paid with — card, UPI or netbanking. A gateway refund cannot be redirected
   * to an arbitrary bank account, and `optimum` speed asks Razorpay to settle
   * as fast as the instrument allows rather than the usual 5-7 working days.
   *
   * Cancelling frees the nights automatically. `blockDates` additionally marks
   * them unavailable, for when the stay is off the market rather than resold.
   */
  async cancelBooking(
    bookingId: string,
    actorId: string,
    options: { reason: string; blockDates?: boolean },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        propertyId: true,
        status: true,
        nights: { select: { date: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException({
        errorCode: ErrorCodes.BOOKING_NOT_FOUND,
        message: 'Booking not found.',
      });
    }

    // Captured before cancelling, which deletes the night rows.
    const nights = booking.nights.map((night) => night.date);

    const result = await this.bookingsService.cancel(
      bookingId,
      { id: actorId, role: UserRole.ADMIN, email: '', name: 'Admin' },
      { reason: options.reason },
      (id, reason) =>
        this.paymentsService.requestRefundForBooking(
          id,
          reason,
          undefined,
          undefined,
          'optimum',
        ),
      (id) => this.paymentsService.cancelOpenPayments(id),
    );

    let blocked = 0;
    if (options.blockDates && nights.length > 0) {
      const future = nights.filter((date) => date >= toUtcDateOnly(new Date()));
      for (const date of future) {
        await this.prisma.availability.upsert({
          where: { propertyId_date: { propertyId: booking.propertyId, date } },
          update: {
            status: AvailabilityStatus.BLOCKED,
            notes: `Blocked on cancellation: ${options.reason}`,
          },
          create: {
            propertyId: booking.propertyId,
            date,
            status: AvailabilityStatus.BLOCKED,
            notes: `Blocked on cancellation: ${options.reason}`,
          },
        });
      }
      blocked = future.length;
    }

    await this.audit.record({
      actorId,
      action: AuditActions.BOOKING_CANCELLED,
      entityType: 'Booking',
      entityId: bookingId,
      metadata: {
        reason: options.reason,
        by: 'ADMIN',
        blockedDates: blocked,
        previousStatus: booking.status,
      },
    });

    return {
      booking: result.booking,
      refund: result.refund,
      blockedDates: blocked,
    };
  }

  async requestRefund(
    bookingId: string,
    actorId: string,
    reason: string,
    amount?: number,
  ) {
    const result = await this.paymentsService.requestRefundForBooking(
      bookingId,
      reason,
      amount,
    );
    await this.audit.record({
      actorId,
      action: AuditActions.REFUND_REQUESTED,
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { reason, amount },
    });
    return result;
  }

  async reconcilePayment(paymentId: string, actorId: string) {
    const result = await this.paymentsService.reconcile(paymentId);
    await this.audit.record({
      actorId,
      action: AuditActions.PAYMENT_RECONCILED,
      entityType: 'Payment',
      entityId: paymentId,
    });
    const raw =
      result && typeof result === 'object' && 'payment' in result
        ? (result as { payment: Parameters<typeof presentAdminPayment>[0] | null })
            .payment
        : null;
    return {
      payment: raw ? presentAdminPayment(raw) : null,
      reconciled:
        typeof result === 'object' &&
        result !== null &&
        'reconciled' in result
          ? Boolean((result as { reconciled?: boolean }).reconciled)
          : Boolean(raw),
    };
  }

  expireAbandonedPayments() {
    return this.paymentsService.expireAbandoned();
  }

  async updateTicket(
    id: string,
    status: SupportTicketStatus,
    actorId: string,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!ticket) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Support ticket not found.',
      });
    }
    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: { status },
    });
    await this.audit.record({
      actorId,
      action: AuditActions.SUPPORT_TICKET_UPDATED,
      entityType: 'SupportTicket',
      entityId: id,
      metadata: { status },
    });
    return updated;
  }

  private presentBooking(booking: {
    id: string;
    customerId: string;
    propertyId: string;
    checkInDate: Date;
    checkOutDate: Date;
    guestCount: number;
    baseAmount: unknown;
    weekendAmount: unknown;
    extraGuestAmount: unknown;
    platformFee: unknown;
    discountAmount: unknown;
    totalAmount: unknown;
    currency: string;
    status: string;
    cancelledAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    customer: { id: string; email: string; name: string };
    property: {
      id: string;
      title: string;
      city?: string;
      state?: string;
      owner: { id: string; name: string; email: string };
    };
    payments: Array<Parameters<typeof presentAdminPayment>[0]>;
    refunds: Array<{
      id: string;
      paymentId?: string;
      amount: unknown;
      status: string;
      reason: string | null;
      providerRefundId?: string | null;
      providerStatus?: string | null;
      createdAt: Date;
    }>;
  }) {
    return {
      id: booking.id,
      customer: booking.customer,
      owner: booking.property.owner,
      property: {
        id: booking.property.id,
        title: booking.property.title,
        city: booking.property.city,
        state: booking.property.state,
      },
      dates: {
        checkIn: booking.checkInDate,
        checkOut: booking.checkOutDate,
      },
      guestCount: booking.guestCount,
      amount: {
        base: money(String(booking.baseAmount)).toFixed(2),
        weekend: money(String(booking.weekendAmount)).toFixed(2),
        extraGuest: money(String(booking.extraGuestAmount)).toFixed(2),
        platformFee: money(String(booking.platformFee)).toFixed(2),
        discount: money(String(booking.discountAmount)).toFixed(2),
        total: money(String(booking.totalAmount)).toFixed(2),
        currency: booking.currency,
      },
      payment: booking.payments[0]
        ? presentAdminPayment(booking.payments[0])
        : null,
      payments: booking.payments.map(presentAdminPayment),
      status: booking.status,
      cancellation: booking.cancelledAt
        ? { cancelledAt: booking.cancelledAt }
        : null,
      refunds: booking.refunds.map((refund) => ({
        id: refund.id,
        paymentId: refund.paymentId,
        amount: money(String(refund.amount)).toFixed(2),
        status: refund.status,
        reason: refund.reason,
        gatewayRefundId: refund.providerRefundId ?? null,
        gatewayStatus: refund.providerStatus ?? null,
        createdAt: refund.createdAt,
      })),
      createdAt: booking.createdAt,
      completedAt: booking.completedAt,
    };
  }

  private assertAdminPropertyTransition(
    current: PropertyStatus,
    next: PropertyStatus,
    restore: boolean,
  ) {
    if (restore) {
      if (
        current !== PropertyStatus.SUSPENDED ||
        next !== PropertyStatus.APPROVED
      ) {
        throw new BadRequestException({
          errorCode: ErrorCodes.INVALID_STATUS_TRANSITION,
          message: 'Only a suspended property can be restored.',
        });
      }
      return;
    }

    const allowed: Partial<Record<PropertyStatus, PropertyStatus[]>> = {
      [PropertyStatus.APPROVED]: [
        PropertyStatus.DRAFT,
        PropertyStatus.PENDING_APPROVAL,
        PropertyStatus.REJECTED,
        PropertyStatus.CHANGES_REQUESTED,
      ],
      [PropertyStatus.REJECTED]: [
        PropertyStatus.PENDING_APPROVAL,
        PropertyStatus.CHANGES_REQUESTED,
      ],
      [PropertyStatus.CHANGES_REQUESTED]: [
        PropertyStatus.PENDING_APPROVAL,
        PropertyStatus.APPROVED,
      ],
      [PropertyStatus.SUSPENDED]: [PropertyStatus.APPROVED],
    };

    if (!allowed[next]?.includes(current)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.INVALID_STATUS_TRANSITION,
        message: 'Property cannot change to that status from its current state.',
      });
    }
  }

  private page(query: AdminListQueryDto) {
    return {
      page: query.page ?? 1,
      limit: Math.min(query.limit ?? 20, 100),
    };
  }
}
