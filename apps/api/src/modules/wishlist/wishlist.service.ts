import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { ErrorCodes } from '../../common/constants/error-codes';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async add(userId: string, propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (
      !property ||
      property.status !== PropertyStatus.APPROVED ||
      property.deletedAt
    ) {
      throw new NotFoundException({
        errorCode: ErrorCodes.PROPERTY_NOT_FOUND,
        message: 'Property not found.',
      });
    }

    try {
      return await this.prisma.wishlistItem.create({
        data: { userId, propertyId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          errorCode: ErrorCodes.CONFLICT,
          message: 'Property is already in the wishlist.',
        });
      }
      throw error;
    }
  }

  async remove(userId: string, propertyId: string) {
    await this.prisma.wishlistItem.deleteMany({
      where: { userId, propertyId },
    });
    return { removed: true };
  }

  list(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        property: {
          include: {
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
