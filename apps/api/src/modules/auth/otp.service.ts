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
import { OTP_STORE, type OtpStore } from './otp/otp-store';
import type { AuthTokens, RequestUser } from './auth.types';
import { RequestOtpDto, VerifyOtpDto, type OtpPurpose } from './dto/otp.dto';
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
    @Inject(OTP_STORE) private readonly store: OtpStore,
  ) {}

  /**
   * Sends a code for a purpose that does NOT issue a session — currently the
   * host phone check during KYC. Kept separate from the public `request` so a
   * verification code can never be replayed against the login endpoint.
   */
  requestForPurpose(
    phone: string,
    purpose: OtpPurpose,
    context: { ipAddress?: string },
  ) {
    return this.request({ phone }, context, purpose);
  }

  /**
   * Validates and burns a challenge without logging anyone in. The caller is
   * responsible for whatever the verified phone then unlocks.
   */
  async consumeForPurpose(
    phone: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    await this.consumeChallenge(phone, purpose, code);
  }

  async request(
    dto: RequestOtpDto,
    context: { ipAddress?: string },
    purposeOverride?: OtpPurpose,
  ): Promise<{
    sent: true;
    phone: string;
    expiresAt: string;
    resendAvailableAt: string;
  }> {
    const phone = dto.phone;
    const purpose: OtpPurpose = purposeOverride ?? dto.purpose ?? 'LOGIN';
    const now = new Date();

    if (purpose === 'LOGIN') {
      const user = await this.prisma.user.findUnique({ where: { phone } });
      if (!user || !user.isActive) {
        return this.opaqueRequestResult(phone, now);
      }
    }

    if (purpose === 'REGISTER') {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing) {
        return this.opaqueRequestResult(phone, now);
      }
    }

    // Cooldown first: it is the cheaper check and the one a user hits most.
    if (await this.store.isCoolingDown(phone, purpose)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.OTP_COOLDOWN,
        message: 'Please wait before requesting another OTP.',
      });
    }

    const sendsInWindow = await this.store.countSends(
      phone,
      purpose,
      this.sendWindowSeconds(),
      now.getTime(),
    );
    if (sendsInWindow >= this.maxSendsPerHour()) {
      throw new BadRequestException({
        errorCode: ErrorCodes.OTP_RATE_LIMITED,
        message: 'Too many OTP requests. Try again later.',
      });
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(now.getTime() + this.ttlMs());

    // Writing the challenge replaces any previous one for this phone and
    // purpose, so only the newest code can ever be verified.
    await this.store.putChallenge(
      phone,
      purpose,
      {
        codeHash: this.hashCode(phone, code),
        attemptCount: 0,
        expiresAt: expiresAt.getTime(),
      },
      Math.ceil(this.ttlMs() / 1000),
    );
    await this.store.recordSend(
      phone,
      purpose,
      this.sendWindowSeconds(),
      now.getTime(),
    );
    await this.store.startCooldown(
      phone,
      purpose,
      Math.ceil(this.resendMs() / 1000),
    );

    await this.sms.send({
      phone,
      message: `Your verification code is ${code}. It expires in ${Math.floor(this.ttlMs() / 1000)} seconds.`,
      // OTP-only gateways render their own template and need the bare code.
      code,
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
    const purpose = dto.purpose ?? 'LOGIN';
    await this.consumeChallenge(dto.phone, purpose, dto.code);

    const user =
      purpose === 'REGISTER'
        ? await this.registerFromOtp(dto)
        : await this.loginFromOtp(dto.phone);

    const tokens = await this.auth.issueSession(user, context);
    return { user, tokens };
  }

  private async consumeChallenge(
    phone: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    const now = Date.now();
    const challenge = await this.store.getChallenge(phone, purpose);

    if (!challenge) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_INVALID,
        message: 'No active OTP was found. Request a new code.',
      });
    }

    // Redis expires the key on its own, but the stored timestamp is still
    // checked so a clock skew or a lingering key cannot extend a code's life.
    if (challenge.expiresAt <= now) {
      await this.store.consumeChallenge(phone, purpose);
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_EXPIRED,
        message: 'This OTP has expired.',
      });
    }

    if (challenge.attemptCount >= this.maxAttempts()) {
      await this.store.consumeChallenge(phone, purpose);
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_LOCKED,
        message: 'Too many incorrect attempts. Request a new OTP.',
      });
    }

    const expected = this.hashCode(phone, code);
    if (!this.safeEqual(expected, challenge.codeHash)) {
      const attempts = await this.store.incrementAttempts(phone, purpose);
      // Burn the challenge as soon as the budget is spent, so the next call
      // reports a locked code rather than handing out another guess.
      if (attempts >= this.maxAttempts()) {
        await this.store.consumeChallenge(phone, purpose);
      }
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_INVALID,
        message: 'The OTP is incorrect.',
      });
    }

    // Whoever deletes the key wins; a second concurrent verify of the same
    // correct code is rejected instead of issuing a second session.
    const claimed = await this.store.consumeChallenge(phone, purpose);
    if (!claimed) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_INVALID,
        message: 'This OTP has already been used.',
      });
    }
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

  private opaqueRequestResult(phone: string, now: Date) {
    return {
      sent: true as const,
      phone: maskPhone(phone),
      expiresAt: new Date(now.getTime() + this.ttlMs()).toISOString(),
      resendAvailableAt: new Date(now.getTime() + this.resendMs()).toISOString(),
    };
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

  /** Trailing window the send limit is measured over. */
  private sendWindowSeconds(): number {
    return 60 * 60;
  }

  private maxSendsPerHour(): number {
    return this.config.get<number>(
      'OTP_MAX_SENDS_PER_HOUR',
      DEFAULT_MAX_SENDS_PER_HOUR,
    );
  }
}
