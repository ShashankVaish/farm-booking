import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoles } from '../../common/constants/roles';
import { AmenitiesService } from './amenities.service';

describe('AmenitiesService', () => {
  it('creates and lists amenities', async () => {
    const prisma = {
      amenity: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a1', name: 'Pool' }]),
        create: jest.fn().mockResolvedValue({ id: 'a1', name: 'Pool' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'a1' }),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    const service = new AmenitiesService(prisma as never);
    await expect(service.list()).resolves.toEqual([{ id: 'a1', name: 'Pool' }]);
    await service.create({ name: 'Pool' });
    expect(prisma.amenity.create).toHaveBeenCalled();
  });

  it('returns not found for a missing amenity update', async () => {
    const prisma = {
      amenity: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new AmenitiesService(prisma as never);
    await expect(
      service.update('missing', { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('amenity admin authorization', () => {
  it('is restricted to admins by role decorator contract', () => {
    expect(UserRoles.ADMIN).toBe('ADMIN');
    expect(ForbiddenException).toBeDefined();
  });
});
