import { Injectable } from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { enumerateNights } from '../../common/dates';
import { paginated } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        include: {
          images: { orderBy: { sortOrder: 'asc' }, take: 5 },
          amenities: { include: { amenity: true } },
        },
        orderBy: this.sortOrder(query.sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.property.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  }

  buildWhere(query: SearchQueryDto): Prisma.PropertyWhereInput {
    const where: Prisma.PropertyWhereInput = {
      status: PropertyStatus.APPROVED,
      deletedAt: null,
    };

    if (query.city) {
      where.city = { equals: query.city, mode: 'insensitive' };
    }
    if (query.state) {
      where.state = { equals: query.state, mode: 'insensitive' };
    }
    if (query.location) {
      where.OR = [
        { location: { contains: query.location, mode: 'insensitive' } },
        { address: { contains: query.location, mode: 'insensitive' } },
        { city: { contains: query.location, mode: 'insensitive' } },
      ];
    }
    if (query.propertyType) {
      where.propertyType = query.propertyType;
    }
    const guestCount = query.guests ?? query.guestCount;
    if (guestCount) {
      where.guestCapacity = { gte: guestCount };
    }
    if (query.bedrooms) {
      where.bedrooms = { gte: query.bedrooms };
    }
    if (query.bathrooms) {
      where.bathrooms = { gte: query.bathrooms };
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.basePrice = {
        gte: query.minPrice,
        lte: query.maxPrice,
      };
    }
    if (query.partyFriendly || query.partyAllowed) {
      where.isPartyFriendly = true;
    }
    if (query.minRating !== undefined) {
      where.averageRating = { gte: query.minRating };
    }
    if (query.pool) {
      where.AND = [
        ...((where.AND as Prisma.PropertyWhereInput[]) ?? []),
        {
          OR: [
            { propertyType: 'POOL_PROPERTY' },
            {
              amenities: {
                some: {
                  amenity: {
                    OR: [
                      { slug: { contains: 'pool', mode: 'insensitive' } },
                      { name: { contains: 'pool', mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          ],
        },
      ];
    }

    const amenityIds = (query.amenities ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (amenityIds.length > 0) {
      where.AND = [
        ...((where.AND as Prisma.PropertyWhereInput[]) ?? []),
        ...amenityIds.map((amenityId) => ({
          amenities: { some: { amenityId } },
        })),
      ];
    }

    if (query.checkIn && query.checkOut) {
      const nights = enumerateNights(query.checkIn, query.checkOut);
      if (nights.length > 0) {
        const range = {
          gte: nights[0],
          lte: nights[nights.length - 1],
        };
        where.AND = [
          ...((where.AND as Prisma.PropertyWhereInput[]) ?? []),
          {
            bookingNights: { none: { date: range } },
          },
          {
            availability: {
              none: {
                date: range,
                status: { in: ['BLOCKED', 'BOOKED'] },
              },
            },
          },
        ];
      }
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
      case 'newest':
        return { createdAt: 'desc' };
      default:
        return [
          { averageRating: 'desc' },
          { reviewCount: 'desc' },
          { createdAt: 'desc' },
        ];
    }
  }
}
