import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, randomBytes, timingSafeEqual } from 'crypto';
import { ErrorCodes } from '../../common/constants/error-codes';
import { UserRoles } from '../../common/constants/roles';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { AuthTokens, RequestUser } from './auth.types';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { PasswordService } from './password.service';
import { maskPhone } from './providers/console-sms.provider';
import {
  SMS_PROVIDER,
  type SmsProvider,
} from './providers/sms-provider.interface';

const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_RESEND_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_MAX_SENDS_PER_HOUR = 5;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly passwords: PasswordService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async request(
    dto: RequestOtpDto,
    context: { ipAddress?: string },
  ): Promise<{
    sent: true;
    phone: string;
    expiresAt: string;
    resendAvailableAt: string;
  }> {
    const phone = dto.phone;
    const purpose = dto.purpose ?? 'LOGIN';
    const now = new Date();

    if (purpose === 'LOGIN') {
      const user = await this.prisma.user.findUnique({ where: { phone } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException({
          errorCode: ErrorCodes.INVALID_CREDENTIALS,
          message: 'No active account exists for this phone number.',
        });
      }
    }

    if (purpose === 'REGISTER') {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing) {
        throw new ConflictException({
          errorCode: ErrorCodes.PHONE_ALREADY_REGISTERED,
          message: 'An account with this phone number already exists.',
        });
      }
    }

    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentSends = await this.prisma.otpChallenge.count({
      where: { phone, purpose, createdAt: { gte: hourAgo } },
    });
    if (recentSends >= this.maxSendsPerHour()) {
      throw new BadRequestException({
        errorCode: ErrorCodes.OTP_RATE_LIMITED,
        message: 'Too many OTP requests. Try again later.',
      });
    }

    const latest = await this.prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (
      latest &&
      now.getTime() - latest.lastSentAt.getTime() < this.resendMs()
    ) {
      throw new BadRequestException({
        errorCode: ErrorCodes.OTP_COOLDOWN,
        message: 'Please wait before requesting another OTP.',
      });
    }

    await this.prisma.otpChallenge.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: now },
    });

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(now.getTime() + this.ttlMs());
    await this.prisma.otpChallenge.create({
      data: {
        phone,
        purpose,
        codeHash: this.hashCode(phone, code),
        expiresAt,
        lastSentAt: now,
        ipAddress: context.ipAddress,
      },
    });

    await this.sms.send({
      phone,
      message: `Your verification code is ${code}. It expires in ${Math.floor(this.ttlMs() / 1000)} seconds.`,
    });

    return {
      sent: true,
      phone: maskPhone(phone),
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: new Date(
        now.getTime() + this.resendMs(),
      ).toISOString(),
    };
  }

  async verify(
    dto: VerifyOtpDto,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<{ user: RequestUser; tokens: AuthTokens }> {
    const phone = dto.phone;
    const purpose = dto.purpose ?? 'LOGIN';
    const now = new Date();

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_INVALID,
        message: 'No active OTP was found. Request a new code.',
      });
    }

    if (challenge.expiresAt.getTime() <= now.getTime()) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_EXPIRED,
        message: 'This OTP has expired.',
      });
    }

    if (challenge.attemptCount >= this.maxAttempts()) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_LOCKED,
        message: 'Too many incorrect attempts. Request a new OTP.',
      });
    }

    const expected = this.hashCode(phone, dto.code);
    if (!this.safeEqual(expected, challenge.codeHash)) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_INVALID,
        message: 'The OTP is incorrect.',
      });
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    });

    const user =
      purpose === 'REGISTER'
        ? await this.registerFromOtp(dto)
        : await this.loginFromOtp(phone);

    const tokens = await this.auth.issueSession(user, context);
    return { user, tokens };
  }

  private async loginFromOtp(phone: string): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.INVALID_CREDENTIALS,
        message: 'No active account exists for this phone number.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }

  private async registerFromOtp(dto: VerifyOtpDto): Promise<RequestUser> {
    if (!dto.name) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Name is required to register with OTP.',
      });
    }

    const email =
      dto.email?.trim().toLowerCase() || `phone-${dto.phone}@otp.local`;
    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException({
        errorCode: ErrorCodes.EMAIL_ALREADY_REGISTERED,
        message: 'An account with this email already exists.',
      });
    }

    const passwordHash = await this.passwords.hash(
      randomBytes(32).toString('hex'),
    );
    const created = await this.prisma.user.create({
      data: {
        email,
        phone: dto.phone,
        passwordHash,
        name: dto.name.trim(),
        role: UserRoles.CUSTOMER,
      },
      select: { id: true, email: true, role: true, name: true },
    });
    return created;
  }

  private hashCode(phone: string, code: string): string {
    const pepper =
      this.config.get<string>('OTP_PEPPER') ??
      this.config.get<string>('JWT_ACCESS_SECRET', 'otp-pepper');
    return createHmac('sha256', pepper)
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }

  private ttlMs(): number {
    return (
      this.config.get<number>('OTP_TTL_SECONDS', DEFAULT_TTL_SECONDS) * 1000
    );
  }

  private resendMs(): number {
    return (
      this.config.get<number>(
        'OTP_RESEND_COOLDOWN_SECONDS',
        DEFAULT_RESEND_SECONDS,
      ) * 1000
    );
  }

  private maxAttempts(): number {
    return this.config.get<number>('OTP_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS);
  }

  private maxSendsPerHour(): number {
    return this.config.get<number>(
      'OTP_MAX_SENDS_PER_HOUR',
      DEFAULT_MAX_SENDS_PER_HOUR,
    );
  }
}
