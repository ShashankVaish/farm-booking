import { ConflictException, Injectable } from '@nestjs/common';
import { AuditActions, AuditService } from '../../common/audit.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './otp.service';
import type {
  RequestPhoneVerificationDto,
  VerifyPhoneDto,
} from './dto/phone-verification.dto';

/*
  Lets any signed-in user prove they own a mobile number.

  A verified phone is what makes an account eligible for WhatsApp messages
  (an unverified number may belong to someone else) and, for hosts, what KYC
  requires. The code is sent with the VERIFY_PHONE purpose, so it can never be
  presented at the login endpoint to open a session.
*/
@Injectable()
export class PhoneVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly audit: AuditService,
  ) {}

  async request(
    userId: string,
    dto: RequestPhoneVerificationDto,
    context: { ipAddress?: string },
  ) {
    await this.assertPhoneFree(userId, dto.phone);
    return this.otp.requestForPurpose(dto.phone, 'VERIFY_PHONE', context);
  }

  async verify(userId: string, dto: VerifyPhoneDto) {
    await this.assertPhoneFree(userId, dto.phone);
    await this.otp.consumeForPurpose(dto.phone, 'VERIFY_PHONE', dto.code);

    await this.prisma.user.update({
      where: { id: userId },
      data: { phone: dto.phone, phoneVerifiedAt: new Date() },
    });

    // Opting in is a separate, explicit choice the customer makes on the same
    // screen; verifying a number alone never turns WhatsApp on.
    if (dto.whatsappOptIn !== undefined) {
      await this.prisma.notificationPreference.upsert({
        where: { userId },
        create: { userId, whatsapp: dto.whatsappOptIn },
        update: { whatsapp: dto.whatsappOptIn },
      });
    }

    await this.audit.record({
      actorId: userId,
      action: AuditActions.USER_PHONE_VERIFIED,
      entityType: 'User',
      entityId: userId,
      metadata: { whatsappOptIn: dto.whatsappOptIn ?? null },
    });

    return { phone: dto.phone, phoneVerified: true };
  }

  private async assertPhoneFree(userId: string, phone: string) {
    const takenBy = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (takenBy && takenBy.id !== userId) {
      throw new ConflictException({
        errorCode: ErrorCodes.PHONE_ALREADY_REGISTERED,
        message: 'This mobile number is already linked to another account.',
      });
    }
  }
}
