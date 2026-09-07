import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditActions, AuditService } from '../../common/audit.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { slugifyExact } from '../../common/slug';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateAmenityDto,
  UpdateAmenityDto,
} from './amenities.controller';

@Injectable()
export class AmenitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.amenity.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateAmenityDto, actorId?: string) {
    const amenity = await this.prisma.amenity.create({
      data: {
        name: dto.name.trim(),
        slug: slugifyExact(dto.name),
        icon: dto.icon,
      },
    });
    if (actorId) {
      await this.audit.record({
        actorId,
        action: AuditActions.AMENITY_CREATED,
        entityType: 'Amenity',
        entityId: amenity.id,
        metadata: { name: amenity.name },
      });
    }
    return amenity;
  }

  async update(id: string, dto: UpdateAmenityDto, actorId?: string) {
    await this.ensure(id);
    const amenity = await this.prisma.amenity.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slug: dto.name ? slugifyExact(dto.name) : undefined,
        icon: dto.icon,
      },
    });
    if (actorId) {
      await this.audit.record({
        actorId,
        action: AuditActions.AMENITY_UPDATED,
        entityType: 'Amenity',
        entityId: id,
      });
    }
    return amenity;
  }

  async remove(id: string, actorId?: string) {
    await this.ensure(id);
    await this.prisma.amenity.delete({ where: { id } });
    if (actorId) {
      await this.audit.record({
        actorId,
        action: AuditActions.AMENITY_DELETED,
        entityType: 'Amenity',
        entityId: id,
      });
    }
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
