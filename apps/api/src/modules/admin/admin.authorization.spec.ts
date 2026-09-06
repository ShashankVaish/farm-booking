import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';

describe('admin authorization', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue([UserRoles.ADMIN]),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  function context(user?: RequestUser): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as ExecutionContext;
  }

  it('rejects customers and owners from admin routes', () => {
    const customer: RequestUser = {
      id: 'c',
      email: 'c@x.com',
      role: UserRoles.CUSTOMER,
      name: 'C',
    };
    const owner: RequestUser = {
      id: 'o',
      email: 'o@x.com',
      role: UserRoles.OWNER,
      name: 'O',
    };
    expect(() => guard.canActivate(context(customer))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(context(owner))).toThrow(ForbiddenException);
  });

  it('allows admins', () => {
    const admin: RequestUser = {
      id: 'a',
      email: 'a@x.com',
      role: UserRoles.ADMIN,
      name: 'A',
    };
    expect(guard.canActivate(context(admin))).toBe(true);
  });
});
