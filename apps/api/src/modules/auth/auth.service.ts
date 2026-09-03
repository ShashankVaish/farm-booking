import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRoles } from '../../common/constants/roles';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import type { AuthTokens, JwtPayload, RequestUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  async register(
    dto: RegisterDto,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: RequestUser; tokens: AuthTokens }> {
    const email = dto.email.trim().toLowerCase();
    const role = dto.role ?? UserRoles.CUSTOMER;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        errorCode: ErrorCodes.EMAIL_ALREADY_REGISTERED,
        message: 'An account with this email already exists.',
      });
    }

    if (dto.phone) {
      const phoneTaken = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (phoneTaken) {
        throw new ConflictException({
          errorCode: ErrorCodes.PHONE_ALREADY_REGISTERED,
          message: 'An account with this phone number already exists.',
        });
      }
    }

    const passwordHash = await this.passwords.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: dto.name.trim(),
          phone: dto.phone,
          role,
        },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
        },
      });

      if (role === UserRoles.OWNER) {
        await tx.ownerProfile.create({
          data: { userId: created.id },
        });
      }

      return created;
    });

    const tokens = await this.issueTokens(user, context);
    return { user, tokens };
  }

  async login(
    dto: LoginDto,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: RequestUser; tokens: AuthTokens }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    const matches = await this.passwords.compare(
      dto.password,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.ACCOUNT_DISABLED,
        message: 'This account has been disabled.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const publicUser: RequestUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const tokens = await this.issueTokens(publicUser, context);
    return { user: publicUser, tokens };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<RequestUser & { phone: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Authentication is required.',
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      phone: user.phone,
    };
  }

  getRefreshCookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('COOKIE_SECURE', false),
      sameSite: 'lax' as const,
      path: '/api/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    };
  }

  private async issueTokens(
    user: RequestUser,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.tokens.signAccessToken(payload);
    const refreshToken = this.tokens.createRefreshToken();
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE_MS),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
    });

    return { accessToken, refreshToken };
  }
}
