import { ConflictException, Injectable } from '@nestjs/common';
import { AuditActions, AuditService } from '../../common/audit.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailOtpService } from './email-otp.service';

/** The stand-in address a phone sign-up gets until it adds a real one. */
export const PLACEHOLDER_EMAIL_DOMAIN = '@otp.local';

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !email || email.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

/**
 * Whether this account still has to add and confirm an email before booking.
 * Accounts made by phone have only a placeholder address, so booking
 * confirmations, receipts and refund notices would have nowhere to go.
 */
export function needsEmailVerification(user: {
  email: string;
  emailVerifiedAt: Date | null;
}): boolean {
  return isPlaceholderEmail(user.email) && !user.emailVerifiedAt;
}

/*
  Lets a signed-in user add an email to their account and prove it is theirs
  with a 6-digit code sent to it.

  Codes use their own purpose (ACCOUNT_EMAIL), so a code issued here cannot be
  spent on password signup, and a signup code cannot confirm an account email.
*/
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailOtp: EmailOtpService,
    private readonly audit: AuditService,
  ) {}

  async request(userId: string, rawEmail: string) {
    const email = EmailOtpService.normalize(rawEmail);
    await this.assertAvailable(userId, email);
    return this.emailOtp.sendCode(email, 'ACCOUNT_EMAIL');
  }

  async verify(userId: string, rawEmail: string, code: string) {
    const email = EmailOtpService.normalize(rawEmail);
    await this.assertAvailable(userId, email);
    await this.emailOtp.checkCode(email, code, 'ACCOUNT_EMAIL');

    await this.prisma.user.update({
      where: { id: userId },
      data: { email, emailVerifiedAt: new Date() },
    });
    await this.audit.record({
      actorId: userId,
      action: AuditActions.USER_EMAIL_VERIFIED,
      entityType: 'User',
      entityId: userId,
    });
    return { email, emailVerified: true };
  }

  private async assertAvailable(userId: string, email: string) {
    if (isPlaceholderEmail(email)) {
      throw new ConflictException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Enter your own email address.',
      });
    }
    const takenBy = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (takenBy && takenBy.id !== userId) {
      throw new ConflictException({
        errorCode: ErrorCodes.EMAIL_ALREADY_REGISTERED,
        message:
          'This email already belongs to another account. Sign in with it, or use a different email.',
      });
    }
  }
}
