import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { ErrorCodes } from '../../common/constants/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { existingAccountEmail, signupOtpEmail } from '../mail/templates';
import { OTP_STORE, type OtpStore } from './otp/otp-store';
import type { OtpPurpose } from './dto/otp.dto';

/** The purpose every key in this service is namespaced under. */
const PURPOSE: OtpPurpose = 'VERIFY_EMAIL';

const DEFAULT_TTL_SECONDS = 600;
const DEFAULT_RESEND_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_MAX_SENDS_PER_HOUR = 5;

/**
 * How long a verified email stays spendable.
 *
 * Longer than the code itself, because somebody who has just proved they own
 * the address still has to choose a password and a name. Short enough that a
 * shared machine does not leave a usable verification lying around all day.
 */
const VERIFIED_TTL_SECONDS = 30 * 60;

/**
 * Email confirmation for password signup.
 *
 * Deliberately separate from `OtpService`, which is keyed by phone number: a
 * code proving somebody reads an inbox must never be presentable at the phone
 * login endpoint, and keeping the two services apart makes that structural
 * rather than a matter of remembering to check a purpose field.
 */
@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    @Inject(OTP_STORE) private readonly store: OtpStore,
  ) {}

  /** Addresses are compared and keyed in one canonical form. */
  static normalize(email: string): string {
    return email.trim().toLowerCase();
  }

  async request(dto: { email: string }): Promise<{
    sent: true;
    email: string;
    expiresAt: string;
    resendAvailableAt: string;
  }> {
    const email = EmailOtpService.normalize(dto.email);
    const now = new Date();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      /*
        Answering "that address is taken" here would turn signup into a
        membership oracle, so the response is identical to a real send.

        But staying silent stranded real people: the form said "check your
        inbox" and no code was ever coming. So the owner of the inbox gets told
        what happened, in an email that only they can read. Sent quietly — a
        delivery failure must not change the response, or the timing difference
        would leak the very thing the opaque result is hiding.
      */
      await this.mail.sendQuietly({
        to: email,
        ...existingAccountEmail({
          brandName: this.mail.brandName(),
          loginUrl: `${this.mail.webUrl()}/auth/login`,
        }),
      });
      return this.opaqueResult(email, now);
    }

    if (await this.store.isCoolingDown(email, PURPOSE)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.OTP_COOLDOWN,
        message: 'Please wait before requesting another code.',
      });
    }

    const sends = await this.store.countSends(
      email,
      PURPOSE,
      this.sendWindowSeconds(),
      now.getTime(),
    );
    if (sends >= this.maxSendsPerHour()) {
      throw new BadRequestException({
        errorCode: ErrorCodes.OTP_RATE_LIMITED,
        message: 'Too many codes requested. Try again later.',
      });
    }

    const code = String(randomInt(100000, 1000000));
    const ttlSeconds = this.ttlSeconds();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    await this.store.putChallenge(
      email,
      PURPOSE,
      {
        codeHash: this.hashCode(email, code),
        attemptCount: 0,
        expiresAt: expiresAt.getTime(),
      },
      ttlSeconds,
    );
    await this.store.recordSend(
      email,
      PURPOSE,
      this.sendWindowSeconds(),
      now.getTime(),
    );
    await this.store.startCooldown(email, PURPOSE, this.resendSeconds());

    // This one surfaces failure: the code is the entire point of the request,
    // so reporting success when nothing was delivered would leave the caller
    // waiting on an email that is never coming. Mapped to a 503 with a specific
    // code, so the UI can say "we could not send it" rather than showing a bare
    // 500 that reads like the form was wrong.
    const message = signupOtpEmail({
      code,
      ttlMinutes: Math.max(1, Math.round(ttlSeconds / 60)),
      brandName: this.mail.brandName(),
    });
    try {
      await this.mail.send({ to: email, ...message });
    } catch (error: unknown) {
      this.logger.error(
        `Could not email a signup code: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.EMAIL_SEND_FAILED,
        message:
          'We could not send the verification email. Please try again shortly.',
      });
    }

    return {
      sent: true,
      email,
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: new Date(
        now.getTime() + this.resendSeconds() * 1000,
      ).toISOString(),
    };
  }

  /**
   * Burns the code and records that the address is confirmed. No session is
   * issued: this proves ownership of an inbox, nothing more.
   */
  async verify(dto: { email: string; code: string }): Promise<{
    verified: true;
    email: string;
    expiresAt: string;
  }> {
    const email = EmailOtpService.normalize(dto.email);
    const now = Date.now();
    const challenge = await this.store.getChallenge(email, PURPOSE);

    if (!challenge) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_INVALID,
        message: 'No active code was found. Request a new one.',
      });
    }

    if (challenge.expiresAt <= now) {
      await this.store.consumeChallenge(email, PURPOSE);
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_EXPIRED,
        message: 'This code has expired.',
      });
    }

    if (challenge.attemptCount >= this.maxAttempts()) {
      await this.store.consumeChallenge(email, PURPOSE);
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_LOCKED,
        message: 'Too many incorrect attempts. Request a new code.',
      });
    }

    if (!this.safeEqual(this.hashCode(email, dto.code), challenge.codeHash)) {
      const attempts = await this.store.incrementAttempts(email, PURPOSE);
      if (attempts >= this.maxAttempts()) {
        await this.store.consumeChallenge(email, PURPOSE);
      }
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_INVALID,
        message: 'The code is incorrect.',
      });
    }

    const claimed = await this.store.consumeChallenge(email, PURPOSE);
    if (!claimed) {
      throw new UnauthorizedException({
        errorCode: ErrorCodes.OTP_INVALID,
        message: 'This code has already been used.',
      });
    }

    await this.store.markVerified(email, PURPOSE, VERIFIED_TTL_SECONDS);

    return {
      verified: true,
      email,
      expiresAt: new Date(
        Date.now() + VERIFIED_TTL_SECONDS * 1000,
      ).toISOString(),
    };
  }

  /**
   * Spends the verification. Called by registration, and only once: a second
   * signup on the same confirmation has to start over.
   */
  async consumeVerification(email: string): Promise<boolean> {
    return this.store.consumeVerified(
      EmailOtpService.normalize(email),
      PURPOSE,
    );
  }

  /** Read-only check, for surfacing state without spending it. */
  async isVerified(email: string): Promise<boolean> {
    return this.store.isVerified(EmailOtpService.normalize(email), PURPOSE);
  }

  /**
   * Identical in shape and timing cost to a real send, so a caller cannot tell
   * a taken address from a free one.
   */
  private opaqueResult(email: string, now: Date) {
    return {
      sent: true as const,
      email,
      expiresAt: new Date(
        now.getTime() + this.ttlSeconds() * 1000,
      ).toISOString(),
      resendAvailableAt: new Date(
        now.getTime() + this.resendSeconds() * 1000,
      ).toISOString(),
    };
  }

  private hashCode(email: string, code: string): string {
    const pepper =
      this.config.get<string>('OTP_PEPPER') ??
      this.config.get<string>('JWT_ACCESS_SECRET', 'otp-pepper');
    // Namespaced so an email code and a phone code with the same digits never
    // produce the same hash.
    return createHmac('sha256', pepper)
      .update(`email:${email}:${code}`)
      .digest('hex');
  }

  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  private ttlSeconds(): number {
    return this.config.get<number>('OTP_TTL_SECONDS', DEFAULT_TTL_SECONDS);
  }

  private resendSeconds(): number {
    return this.config.get<number>(
      'OTP_RESEND_COOLDOWN_SECONDS',
      DEFAULT_RESEND_SECONDS,
    );
  }

  private maxAttempts(): number {
    return this.config.get<number>('OTP_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS);
  }

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
