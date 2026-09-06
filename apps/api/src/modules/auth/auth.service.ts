import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRoles } from '../../common/constants/roles';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { randomUUID } from 'crypto';
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

    const tokens = await this.issueSession(user, context);
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

    const tokens = await this.issueSession(publicUser, context);
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

  async refresh(
    refreshToken: string | undefined,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: RequestUser; tokens: AuthTokens }> {
    if (!refreshToken) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: 'Refresh token is missing.',
      });
    }

    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!existing) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: 'Refresh token is invalid.',
      });
    }

    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        errorCode: ErrorCodes.REFRESH_TOKEN_REUSE,
        message: 'Refresh token reuse was detected. Please sign in again.',
      });
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.INVALID_REFRESH_TOKEN,
        message: 'Refresh token has expired.',
      });
    }

    if (!existing.user.isActive) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.ACCOUNT_DISABLED,
        message: 'This account has been disabled.',
      });
    }

    const publicUser: RequestUser = {
      id: existing.user.id,
      email: existing.user.email,
      role: existing.user.role,
      name: existing.user.name,
    };

    const tokens = await this.issueSession(publicUser, context, {
      familyId: existing.familyId,
      replacesId: existing.id,
    });

    return { user: publicUser, tokens };
  }

  issueSession(
    user: RequestUser,
    context: { userAgent?: string; ipAddress?: string },
    rotation?: { familyId: string; replacesId: string },
  ): Promise<AuthTokens> {
    return this.issueTokens(user, context, rotation);
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

  async updateMe(
    userId: string,
    dto: { name?: string; phone?: string },
  ): Promise<RequestUser & { phone: string | null }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.phone ? { phone: dto.phone } : {}),
      },
    });
    return this.me(userId);
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
    rotation?: { familyId: string; replacesId: string },
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.tokens.signAccessToken(payload);
    const refreshToken = this.tokens.createRefreshToken();
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const id = randomUUID();
    const familyId = rotation?.familyId ?? randomUUID();

    await this.prisma.$transaction(async (tx) => {
      if (rotation) {
        await tx.refreshToken.update({
          where: { id: rotation.replacesId },
          data: { revokedAt: new Date(), replacedById: id },
        });
      }

      await tx.refreshToken.create({
        data: {
          id,
          userId: user.id,
          familyId,
          tokenHash,
          expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE_MS),
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
        },
      });
    });

    return { accessToken, refreshToken };
  }
}
