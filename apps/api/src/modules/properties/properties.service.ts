import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { ErrorCodes } from '../../common/constants/error-codes';
import { UserRoles } from '../../common/constants/roles';
import { paginated } from '../../common/pagination';
import { slugify } from '../../common/slug';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../auth/auth.types';
import { assertValidCoordinates } from '../locations/geo';
import {
  CreatePropertyDto,
  ListPropertiesQueryDto,
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
  constructor(private readonly prisma: PrismaService) {}

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
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: publicInclude,
    });

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

  async update(id: string, user: RequestUser, dto: UpdatePropertyDto) {
    const property = await this.requireManaged(id, user);

    if (dto.status && dto.status !== property.status) {
      assertPropertyStatusTransition(property.status, dto.status, user);
    }

    const { amenityIds, status, images, ...rest } = dto;
    if (rest.latitude !== undefined || rest.longitude !== undefined) {
      assertValidCoordinates(
        rest.latitude ?? Number(property.latitude),
        rest.longitude ?? Number(property.longitude),
      );
    }

    return this.prisma.$transaction(async (tx) => {
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
