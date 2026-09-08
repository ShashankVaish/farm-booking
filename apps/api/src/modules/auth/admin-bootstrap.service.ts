import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from './password.service';

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureAdminFromEnv();
  }

  async ensureAdminFromEnv(): Promise<'created' | 'updated' | 'skipped'> {
    const email = (this.config.get<string>('ADMIN_EMAIL') ?? 'admin')
      .trim()
      .toLowerCase();
    const password = this.config.get<string>('ADMIN_PASSWORD')?.trim() ?? '';
    const name = (this.config.get<string>('ADMIN_NAME') ?? 'Admin').trim();

    if (!password) {
      this.logger.warn(
        'ADMIN_PASSWORD is empty. Set it in .env to create or update the admin login.',
      );
      return 'skipped';
    }

    if (password.length < 8) {
      this.logger.error(
        'ADMIN_PASSWORD must be at least 8 characters. Admin bootstrap skipped.',
      );
      return 'skipped';
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    const passwordHash = await this.passwords.hash(password);

    if (!existing) {
      await this.prisma.user.create({
        data: {
          email,
          name: name || 'Admin',
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
      });
      this.logger.log(`Admin account created for login "${email}".`);
      return 'created';
    }

    if (existing.role !== UserRole.ADMIN) {
      this.logger.error(
        `ADMIN_EMAIL "${email}" matches a non-admin user. Refusing to escalate privileges.`,
      );
      return 'skipped';
    }

    const samePassword = await this.passwords.compare(
      password,
      existing.passwordHash,
    );

    await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        name: name || existing.name,
        ...(samePassword ? {} : { passwordHash }),
      },
    });
    this.logger.log(`Admin account synced for login "${email}".`);
    return 'updated';
  }
}
