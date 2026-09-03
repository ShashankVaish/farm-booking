import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestUser } from '../../modules/auth/auth.types';
import { UserRoles } from '../constants/roles';

function createContext(user?: RequestUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows access when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows an owner to access owner routes', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRoles.OWNER,
    ]);

    const user: RequestUser = {
      id: '1',
      email: 'owner@example.com',
      role: UserRoles.OWNER,
      name: 'Owner',
    };

    expect(guard.canActivate(createContext(user))).toBe(true);
  });

  it('allows an admin to access owner routes', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation(
      (key: string) => (key === ROLES_KEY ? [UserRoles.OWNER] : undefined),
    );

    const user: RequestUser = {
      id: '2',
      email: 'admin@example.com',
      role: UserRoles.ADMIN,
      name: 'Admin',
    };

    expect(guard.canActivate(createContext(user))).toBe(true);
  });

  it('rejects a customer from owner routes', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRoles.OWNER,
    ]);

    const user: RequestUser = {
      id: '3',
      email: 'customer@example.com',
      role: UserRoles.CUSTOMER,
      name: 'Customer',
    };

    expect(() => guard.canActivate(createContext(user))).toThrow();
  });
});
