import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '../../common/constants/error-codes';
import { slugifyExact } from '../../common/slug';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateAmenityDto,
  UpdateAmenityDto,
} from './amenities.controller';

@Injectable()
export class AmenitiesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.amenity.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateAmenityDto) {
    return this.prisma.amenity.create({
      data: {
        name: dto.name.trim(),
        slug: slugifyExact(dto.name),
        icon: dto.icon,
      },
    });
  }

  async update(id: string, dto: UpdateAmenityDto) {
    await this.ensure(id);
    return this.prisma.amenity.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slug: dto.name ? slugifyExact(dto.name) : undefined,
        icon: dto.icon,
      },
    });
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.amenity.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensure(id: string) {
    const amenity = await this.prisma.amenity.findUnique({ where: { id } });
    if (!amenity) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Amenity not found.',
      });
    }
  }
}
