import { ConfigService } from '@nestjs/config';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { PasswordService } from './password.service';

describe('AdminBootstrapService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const passwords = {
    hash: jest.fn().mockResolvedValue('hashed'),
    compare: jest.fn().mockResolvedValue(false),
  };
  const values: Record<string, string | undefined> = {
    ADMIN_EMAIL: 'admin',
    ADMIN_PASSWORD: 'AdminPass1',
    ADMIN_NAME: 'Platform Admin',
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;

  const service = new AdminBootstrapService(
    config,
    prisma as never,
    passwords as unknown as PasswordService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    values.ADMIN_EMAIL = 'admin';
    values.ADMIN_PASSWORD = 'AdminPass1';
    passwords.hash.mockResolvedValue('hashed');
    passwords.compare.mockResolvedValue(false);
  });

  it('skips when ADMIN_PASSWORD is empty', async () => {
    values.ADMIN_PASSWORD = '';
    await expect(service.ensureAdminFromEnv()).resolves.toBe('skipped');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates an admin from env credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.ensureAdminFromEnv()).resolves.toBe('created');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin',
          role: 'ADMIN',
          passwordHash: 'hashed',
        }),
      }),
    );
  });

  it('promotes an existing user and refreshes the password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'admin',
      name: 'Old',
      passwordHash: 'old-hash',
    });
    await expect(service.ensureAdminFromEnv()).resolves.toBe('updated');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'ADMIN',
          passwordHash: 'hashed',
        }),
      }),
    );
  });
});
