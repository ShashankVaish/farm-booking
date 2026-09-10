import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KycStatus } from '@prisma/client';
import { AuditService } from '../../common/audit.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from '../auth/otp.service';
import {
  RequestHostPhoneOtpDto,
  SaveBankAccountDto,
  SubmitHostKycDto,
  VerifyHostPhoneOtpDto,
} from './dto/kyc.dto';
import {
  aadhaarLast4,
  accountLast4,
  hashAadhaar,
  isValidAadhaar,
  isValidAccountNumber,
  isValidIfsc,
  isValidPan,
  maskAadhaar,
  maskAccount,
  normalizeAadhaar,
  normalizeAccountNumber,
  normalizeIfsc,
  normalizePan,
} from './kyc.util';

@Injectable()
export class HostKycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /** Everything the host wizard needs to render the verification step. */
  async status(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        phoneVerifiedAt: true,
        ownerProfile: {
          select: {
            businessName: true,
            panNumber: true,
            panImageUrl: true,
            aadhaarLast4: true,
            aadhaarImageUrl: true,
            kycStatus: true,
            kycSubmittedAt: true,
            kycReviewedAt: true,
            kycRejectionReason: true,
            kycVerified: true,
            bankAccountName: true,
            bankAccountLast4: true,
            bankIfsc: true,
            bankName: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Owner profile not found.',
      });
    }

    const profile = user.ownerProfile;
    const kycStatus = profile?.kycStatus ?? KycStatus.NOT_SUBMITTED;
    const phoneVerified = Boolean(user.phoneVerifiedAt);
    const documentsSubmitted =
      kycStatus === KycStatus.SUBMITTED || kycStatus === KycStatus.VERIFIED;

    return {
      phone: user.phone,
      phoneVerified,
      phoneVerifiedAt: user.phoneVerifiedAt,
      kycStatus,
      kycSubmittedAt: profile?.kycSubmittedAt ?? null,
      kycReviewedAt: profile?.kycReviewedAt ?? null,
      kycRejectionReason: profile?.kycRejectionReason ?? null,
      // The raw Aadhaar number is never stored, so it can never be returned.
      aadhaarMasked: maskAadhaar(profile?.aadhaarLast4),
      aadhaarImageUrl: profile?.aadhaarImageUrl ?? null,
      panNumber: profile?.panNumber ?? null,
      panImageUrl: profile?.panImageUrl ?? null,
      businessName: profile?.businessName ?? null,
      bankAccountName: profile?.bankAccountName ?? null,
      // Never return the full account number once stored.
      bankAccountMasked: maskAccount(profile?.bankAccountLast4),
      bankIfsc: profile?.bankIfsc ?? null,
      bankName: profile?.bankName ?? null,
      bankAccountSaved: Boolean(profile?.bankAccountLast4),
      /** A listing may only be submitted for review once both of these hold. */
      canSubmitListing: phoneVerified && documentsSubmitted,
    };
  }

  async requestPhoneOtp(
    userId: string,
    dto: RequestHostPhoneOtpDto,
    context: { ipAddress?: string },
  ) {
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!owner) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Owner profile not found.',
      });
    }

    const takenBy = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true },
    });
    if (takenBy && takenBy.id !== userId) {
      throw new ConflictException({
        errorCode: ErrorCodes.PHONE_ALREADY_REGISTERED,
        message: 'This mobile number is already linked to another account.',
      });
    }

    return this.otp.requestForPurpose(dto.phone, 'VERIFY_PHONE', context);
  }

  async verifyPhoneOtp(userId: string, dto: VerifyHostPhoneOtpDto) {
    const takenBy = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true },
    });
    if (takenBy && takenBy.id !== userId) {
      throw new ConflictException({
        errorCode: ErrorCodes.PHONE_ALREADY_REGISTERED,
        message: 'This mobile number is already linked to another account.',
      });
    }

    await this.otp.consumeForPurpose(dto.phone, 'VERIFY_PHONE', dto.code);

    await this.prisma.user.update({
      where: { id: userId },
      data: { phone: dto.phone, phoneVerifiedAt: new Date() },
    });

    await this.audit.record({
      actorId: userId,
      action: 'HOST_PHONE_VERIFIED',
      entityType: 'User',
      entityId: userId,
    });

    return this.status(userId);
  }

  async submit(userId: string, dto: SubmitHostKycDto) {
    const aadhaar = normalizeAadhaar(dto.aadhaarNumber);
    if (!isValidAadhaar(aadhaar)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Enter a valid 12-digit Aadhaar number.',
      });
    }

    const pan = normalizePan(dto.panNumber);
    if (!isValidPan(pan)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Enter a valid PAN, for example ABCDE1234F.',
      });
    }

    if (!this.isStoredMedia(dto.aadhaarImageUrl) || !this.isStoredMedia(dto.panImageUrl)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Upload both document photos before submitting.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phoneVerifiedAt: true },
    });
    if (!user?.phoneVerifiedAt) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Verify your mobile number before submitting documents.',
      });
    }

    const hash = hashAadhaar(aadhaar, this.pepper());
    const clash = await this.prisma.ownerProfile.findFirst({
      where: { aadhaarHash: hash, NOT: { userId } },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'This Aadhaar is already registered to another host account.',
      });
    }

    const data = {
      businessName: dto.businessName?.trim() || undefined,
      panNumber: pan,
      panImageUrl: dto.panImageUrl,
      aadhaarLast4: aadhaarLast4(aadhaar),
      aadhaarHash: hash,
      aadhaarImageUrl: dto.aadhaarImageUrl,
      kycStatus: KycStatus.SUBMITTED,
      kycSubmittedAt: new Date(),
      kycReviewedAt: null,
      kycRejectionReason: null,
    };

    await this.prisma.ownerProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    await this.audit.record({
      actorId: userId,
      action: 'HOST_KYC_SUBMITTED',
      entityType: 'User',
      entityId: userId,
      // Only the last four digits are ever written to the audit trail.
      metadata: { aadhaarLast4: data.aadhaarLast4, panNumber: pan },
    });

    return this.status(userId);
  }

  /**
   * Where the host's earnings are paid out. This is not the refund path:
   * guest refunds always go back through the gateway to the card or UPI the
   * booking was paid with, never to an account entered by hand.
   */
  async saveBankAccount(userId: string, dto: SaveBankAccountDto) {
    const accountNumber = normalizeAccountNumber(dto.accountNumber);
    if (!isValidAccountNumber(accountNumber)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Enter a valid bank account number (9 to 18 digits).',
      });
    }

    const ifsc = normalizeIfsc(dto.ifsc);
    if (!isValidIfsc(ifsc)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Enter a valid IFSC code, for example HDFC0001234.',
      });
    }

    const holder = dto.accountHolderName.trim();
    if (holder.length < 3) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: "Enter the account holder's full name as it appears on the account.",
      });
    }

    const data = {
      bankAccountName: holder,
      bankAccountNumber: accountNumber,
      bankAccountLast4: accountLast4(accountNumber),
      bankIfsc: ifsc,
      bankName: dto.bankName?.trim() || undefined,
    };

    await this.prisma.ownerProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    await this.audit.record({
      actorId: userId,
      action: 'HOST_BANK_ACCOUNT_SAVED',
      entityType: 'User',
      entityId: userId,
      // The account number itself never reaches the audit trail.
      metadata: { last4: data.bankAccountLast4, ifsc },
    });

    return this.status(userId);
  }

  /**
   * Document photos must come from our own upload endpoint. Accepting an
   * arbitrary URL would let a host point the reviewer at a remote image they
   * can swap out after approval.
   */
  private isStoredMedia(url: string): boolean {
    return /^\/uploads\/[A-Za-z0-9._/-]+$/.test(url);
  }

  private pepper(): string {
    return (
      this.config.get<string>('OTP_PEPPER') ||
      this.config.get<string>('JWT_ACCESS_SECRET', 'kyc-pepper')
    );
  }
}
