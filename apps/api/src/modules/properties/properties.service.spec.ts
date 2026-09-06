import { NotFoundException } from '@nestjs/common';
import { UserRoles } from '../../common/constants/roles';
import { PropertiesService } from './properties.service';
import { canManageProperty } from './property-status';
import type { RequestUser } from '../auth/auth.types';

describe('property ownership authorization', () => {
  const owner: RequestUser = {
    id: 'owner-1',
    email: 'owner@example.com',
    role: UserRoles.OWNER,
    name: 'Owner',
  };
  const otherOwner: RequestUser = {
    id: 'owner-2',
    email: 'other@example.com',
    role: UserRoles.OWNER,
    name: 'Other',
  };
  const admin: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRoles.ADMIN,
    name: 'Admin',
  };
  const customer: RequestUser = {
    id: 'cust-1',
    email: 'c@example.com',
    role: UserRoles.CUSTOMER,
    name: 'Customer',
  };

  it('allows the owning user and admin only', () => {
    expect(canManageProperty('owner-1', owner)).toBe(true);
    expect(canManageProperty('owner-1', admin)).toBe(true);
    expect(canManageProperty('owner-1', otherOwner)).toBe(false);
    expect(canManageProperty('owner-1', customer)).toBe(false);
  });

  it('hides non-approved properties from customers', async () => {
    const prisma = {
      property: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          ownerId: 'owner-1',
          status: 'DRAFT',
        }),
      },
    };
    const service = new PropertiesService(prisma as never);
    await expect(service.getById('p1', customer)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.getById('p1', owner)).resolves.toBeDefined();
  });
});
