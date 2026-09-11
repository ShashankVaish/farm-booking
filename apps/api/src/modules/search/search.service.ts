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
      // Every word in the query must appear somewhere on the property, and each
      // word matches as a substring. So "sambhal garden" finds "sambhal garden",
      // "garden sambhal" and "Sambhal Gardens", while "goa villa" will not match
      // a Goa property that is not a villa. Title was previously not searched at
      // all, so searching a stay by its own name returned nothing.
      const terms = Array.from(
        new Set(
          query.location
            .toLowerCase()
            .split(/[\s,]+/)
            .map((term) => term.trim())
            .filter((term) => term.length > 0),
        ),
      ).slice(0, 8);

      if (terms.length > 0) {
        where.AND = [
          ...((where.AND as Prisma.PropertyWhereInput[]) ?? []),
          ...terms.map((term) => ({
            OR: [
              { title: { contains: term, mode: 'insensitive' as const } },
              { location: { contains: term, mode: 'insensitive' as const } },
              { address: { contains: term, mode: 'insensitive' as const } },
              { city: { contains: term, mode: 'insensitive' as const } },
              { state: { contains: term, mode: 'insensitive' as const } },
              { country: { contains: term, mode: 'insensitive' as const } },
              { pincode: { contains: term, mode: 'insensitive' as const } },
              { description: { contains: term, mode: 'insensitive' as const } },
              {
                amenities: {
                  some: {
                    amenity: {
                      name: { contains: term, mode: 'insensitive' as const },
                    },
                  },
                },
              },
            ],
          })),
        ];
      }
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
    if (query.trusted) {
      where.isTrusted = true;
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
