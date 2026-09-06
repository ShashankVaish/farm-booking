import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRoles } from '../../common/constants/roles';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ownerProfile: {
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const passwords = {
    hash: jest.fn(),
    compare: jest.fn(),
  };

  const tokens = {
    signAccessToken: jest.fn(),
    createRefreshToken: jest.fn(),
    hashRefreshToken: jest.fn(),
  };

  const config = {
    get: jest.fn().mockReturnValue(false),
  } as unknown as ConfigService;

  const service = new AuthService(
    prisma as never,
    passwords as unknown as PasswordService,
    tokens as unknown as TokenService,
    config,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tokens.signAccessToken.mockResolvedValue('access-token');
    tokens.createRefreshToken.mockReturnValue('refresh-token');
    tokens.hashRefreshToken.mockReturnValue('hashed-refresh');
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
  });

  it('registers a customer and issues tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    passwords.hash.mockResolvedValue('hashed-password');
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'ada@example.com',
      role: UserRoles.CUSTOMER,
      name: 'Ada',
    });

    const result = await service.register(
      {
        email: 'Ada@Example.com',
        password: 'Secret123',
        name: 'Ada',
      },
      {},
    );

    expect(result.user.email).toBe('ada@example.com');
    expect(result.tokens.accessToken).toBe('access-token');
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.ownerProfile.create).not.toHaveBeenCalled();
  });

  it('creates an owner profile when registering as owner', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    passwords.hash.mockResolvedValue('hashed-password');
    prisma.user.create.mockResolvedValue({
      id: 'user-2',
      email: 'owner@example.com',
      role: UserRoles.OWNER,
      name: 'Owner',
    });

    await service.register(
      {
        email: 'owner@example.com',
        password: 'Secret123',
        name: 'Owner',
        role: UserRoles.OWNER,
      },
      {},
    );

    expect(prisma.ownerProfile.create).toHaveBeenCalledWith({
      data: { userId: 'user-2' },
    });
  });

  it('rejects duplicate emails', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register(
        {
          email: 'ada@example.com',
          password: 'Secret123',
          name: 'Ada',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('revokes a token family when a revoked refresh token is reused', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      familyId: 'fam-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
      user: {
        id: 'user-1',
        email: 'ada@example.com',
        role: UserRoles.CUSTOMER,
        name: 'Ada',
        isActive: true,
      },
    });

    await expect(service.refresh('stolen-token', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: 'fam-1', revokedAt: null },
      }),
    );
  });
});
