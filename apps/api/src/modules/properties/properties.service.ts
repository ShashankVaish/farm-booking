import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { KycStatus, Prisma, PropertyStatus } from '@prisma/client';
import { ErrorCodes } from '../../common/constants/error-codes';
import { UserRoles } from '../../common/constants/roles';
import { paginated } from '../../common/pagination';
import { slugify } from '../../common/slug';
import { isUuid } from '../../common/uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { propertySubmittedEmail } from '../mail/templates';
import type { RequestUser } from '../auth/auth.types';
import { assertValidCoordinates } from '../locations/geo';
import {
  CreatePropertyDto,
  ListPropertiesQueryDto,
  MAX_LISTING_PHOTOS,
  UpdatePropertyDto,
} from './dto/property.dto';
import {
  assertPropertyStatusTransition,
  canManageProperty,
} from './property-status';

const publicInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  amenities: { include: { amenity: true } },
  owner: { select: { id: true, name: true } },
};

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async create(user: RequestUser, dto: CreatePropertyDto) {
    if (user.role !== UserRoles.OWNER && user.role !== UserRoles.ADMIN) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Only owners can create properties.',
      });
    }

    assertValidCoordinates(dto.latitude, dto.longitude);

    return this.prisma.property.create({
      data: {
        ownerId: user.role === UserRoles.ADMIN ? user.id : user.id,
        title: dto.title.trim(),
        slug: slugify(dto.title),
        description: dto.description.trim(),
        propertyType: dto.propertyType,
        location: dto.location.trim(),
        city: dto.city.trim(),
        state: dto.state.trim(),
        country: dto.country?.trim() || 'India',
        pincode: dto.pincode,
        address: dto.address.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        guestCapacity: dto.guestCapacity,
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        basePrice: dto.basePrice,
        weekendPrice: dto.weekendPrice,
        extraGuestCharge: dto.extraGuestCharge,
        partyRules: dto.partyRules,
        propertyRules: dto.propertyRules,
        cancellationPolicy: dto.cancellationPolicy,
        isPartyFriendly: dto.isPartyFriendly ?? false,
        isAdultOnly: dto.isAdultOnly ?? false,
        isCoupleFriendly: dto.isCoupleFriendly ?? false,
        status: PropertyStatus.DRAFT,
        amenities: dto.amenityIds
          ? {
              create: dto.amenityIds.map((amenityId) => ({ amenityId })),
            }
          : undefined,
        images: dto.images
          ? {
              create: dto.images.map((image, index) => ({
                url: image.url,
                publicId: image.publicId,
                altText: image.altText,
                sortOrder: image.sortOrder ?? index,
                isCover: image.isCover ?? index === 0,
              })),
            }
          : undefined,
      },
      include: publicInclude,
    });
  }

  async list(query: ListPropertiesQueryDto, user?: RequestUser) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where = this.listWhere(query, user);
    const orderBy = this.sortOrder(query.sort);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        include: publicInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.property.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  }

  async getById(id: string, user?: RequestUser) {
    const byId = isUuid(id)
      ? await this.prisma.property.findUnique({
          where: { id },
          include: publicInclude,
        })
      : null;
    const property =
      byId ??
      (await this.prisma.property.findUnique({
        where: { slug: id },
        include: publicInclude,
      }));

    if (!property || property.deletedAt) {
      throw new NotFoundException({
        errorCode: ErrorCodes.PROPERTY_NOT_FOUND,
        message: 'Property not found.',
      });
    }

    if (
      property.status !== PropertyStatus.APPROVED &&
      (!user || !canManageProperty(property.ownerId, user))
    ) {
      throw new NotFoundException({
        errorCode: ErrorCodes.PROPERTY_NOT_FOUND,
        message: 'Property not found.',
      });
    }

    return property;
  }

  /**
   * A listing cannot enter the review queue until the host has verified their
   * mobile number and submitted identity documents. Enforced server-side so it
   * holds even if the wizard step is bypassed.
   */
  private async assertHostVerified(ownerId: string): Promise<void> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        phoneVerifiedAt: true,
        ownerProfile: { select: { kycStatus: true } },
      },
    });

    if (!owner?.phoneVerifiedAt) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message:
          'Verify your mobile number before submitting a listing for review.',
      });
    }

    const kycStatus = owner.ownerProfile?.kycStatus;
    if (kycStatus !== KycStatus.SUBMITTED && kycStatus !== KycStatus.VERIFIED) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message:
          'Submit your Aadhaar and PAN details before submitting a listing for review.',
      });
    }
  }

  /**
   * Photos are capped, not required.
   *
   * There used to be a four-photo floor here as well. The listing wizard
   * stopped asking for four, so a host could finish every step and then be
   * refused at submission by a rule nothing had mentioned — the client asked
   * for the minimum to go, and it has to go on this side too or the wizard
   * change does nothing.
   */
  private assertPhotoCount(count: number): void {
    if (count > MAX_LISTING_PHOTOS) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: `Add no more than ${MAX_LISTING_PHOTOS} photos.`,
      });
    }
  }

  async update(id: string, user: RequestUser, dto: UpdatePropertyDto) {
    const property = await this.requireManaged(id, user);

    if (dto.status && dto.status !== property.status) {
      assertPropertyStatusTransition(property.status, dto.status, user);
      if (
        dto.status === PropertyStatus.PENDING_APPROVAL &&
        user.role !== UserRoles.ADMIN
      ) {
        await this.assertHostVerified(property.ownerId);
        // Count the photos this request will leave behind, not the stored set,
        // so submitting and re-photographing in one call is judged correctly.
        const photoCount =
          dto.images?.length ??
          (await this.prisma.propertyImage.count({
            where: { propertyId: id },
          }));
        this.assertPhotoCount(photoCount);
      }
    }

    const { amenityIds, status, images, ...rest } = dto;
    if (rest.latitude !== undefined || rest.longitude !== undefined) {
      assertValidCoordinates(
        rest.latitude ?? Number(property.latitude),
        rest.longitude ?? Number(property.longitude),
      );
    }

    const submittedForReview =
      status === PropertyStatus.PENDING_APPROVAL &&
      property.status !== PropertyStatus.PENDING_APPROVAL;

    const saved = await this.prisma.$transaction(async (tx) => {
      if (amenityIds) {
        await tx.propertyAmenity.deleteMany({ where: { propertyId: id } });
        if (amenityIds.length > 0) {
          await tx.propertyAmenity.createMany({
            data: amenityIds.map((amenityId) => ({
              propertyId: id,
              amenityId,
            })),
          });
        }
      }

      if (images) {
        await tx.propertyImage.deleteMany({ where: { propertyId: id } });
        if (images.length > 0) {
          await tx.propertyImage.createMany({
            data: images.map((image, index) => ({
              propertyId: id,
              url: image.url,
              publicId: image.publicId,
              altText: image.altText,
              sortOrder: image.sortOrder ?? index,
              isCover: image.isCover ?? index === 0,
            })),
          });
        }
      }

      return tx.property.update({
        where: { id },
        data: {
          ...rest,
          status,
        },
        include: publicInclude,
      });
    });

    if (submittedForReview) {
      await this.notifyAdminOfSubmission(saved.id);
    }

    return saved;
  }

  /**
   * Tells the operations inbox that a listing is waiting to be reviewed.
   *
   * Deliberately outside the transaction and deliberately quiet: a mail server
   * that is down must not roll back the host's submission or surface as an
   * error on their screen. The listing is saved either way, and it is still
   * visible in the admin queue — the email is a prompt, not the record.
   */
  private async notifyAdminOfSubmission(propertyId: string): Promise<void> {
    try {
      await this.sendSubmissionAlert(propertyId);
    } catch (error: unknown) {
      /*
        This runs after the transaction has committed, so anything thrown here
        would report a failure for a submission that actually succeeded — the
        host would see an error and resubmit a listing already in the queue.
        `sendQuietly` swallows transport failures, but the lookup and render
        above it can still throw, so the whole path is guarded rather than
        trusting one link in it.
      */
      this.logger.error(
        `Could not alert the admin inbox about property ${propertyId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async sendSubmissionAlert(propertyId: string): Promise<void> {
    const to = this.mail.adminAddress();
    if (!to) return;

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        title: true,
        city: true,
        state: true,
        location: true,
        updatedAt: true,
        owner: { select: { name: true, email: true } },
      },
    });
    if (!property) return;

    const where = [property.city, property.state].filter(Boolean).join(', ');
    const email = propertySubmittedEmail({
      propertyTitle: property.title,
      propertyLocation: where || property.location || 'Not specified',
      hostName: property.owner?.name ?? 'Unknown host',
      hostEmail: property.owner?.email ?? 'unknown',
      submittedAt: property.updatedAt,
      reviewUrl: `${this.mail.webUrl()}/admin/properties/${property.id}`,
      brandName: this.mail.brandName(),
    });

    await this.mail.sendQuietly({ to, ...email });
  }

  async remove(id: string, user: RequestUser) {
    await this.requireManaged(id, user);

    const activeBookings = await this.prisma.booking.count({
      where: {
        propertyId: id,
        status: { in: ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED'] },
      },
    });

    if (activeBookings > 0) {
      throw new ConflictException({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Cannot delete a property with active bookings.',
      });
    }

    await this.prisma.property.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async requireManaged(id: string, user: RequestUser) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property || property.deletedAt) {
      throw new NotFoundException({
        errorCode: ErrorCodes.PROPERTY_NOT_FOUND,
        message: 'Property not found.',
      });
    }

    if (!canManageProperty(property.ownerId, user)) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'You do not own this property.',
      });
    }

    return property;
  }

  private listWhere(
    query: ListPropertiesQueryDto,
    user?: RequestUser,
  ): Prisma.PropertyWhereInput {
    const where: Prisma.PropertyWhereInput = { deletedAt: null };

    if (query.city) {
      where.city = { equals: query.city, mode: 'insensitive' };
    }
    if (query.state) {
      where.state = { equals: query.state, mode: 'insensitive' };
    }
    if (query.propertyType) {
      where.propertyType = query.propertyType;
    }

    if (!user || user.role === UserRoles.CUSTOMER) {
      where.status = PropertyStatus.APPROVED;
      return where;
    }

    if (user.role === UserRoles.ADMIN) {
      if (query.status) {
        where.status = query.status;
      }
      return where;
    }

    where.OR = [{ ownerId: user.id }, { status: PropertyStatus.APPROVED }];
    if (query.status) {
      where.AND = [{ status: query.status }];
    }
    return where;
  }

  private sortOrder(
    sort?: string,
  ):
    | Prisma.PropertyOrderByWithRelationInput
    | Prisma.PropertyOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return { basePrice: 'asc' };
      case 'price_desc':
        return { basePrice: 'desc' };
      case 'rating':
        return [{ averageRating: 'desc' }, { reviewCount: 'desc' }];
      default:
        return { createdAt: 'desc' };
    }
  }
}
