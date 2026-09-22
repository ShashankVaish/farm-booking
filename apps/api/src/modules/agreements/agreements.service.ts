import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditActions, AuditService } from '../../common/audit.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { UserRoles } from '../../common/constants/roles';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../auth/auth.types';
import { PublishAgreementDto, SignAgreementDto } from './dto/agreement.dto';

/*
  The host agreement: what a host signs before a listing can be submitted.

  Two rules shape everything here.

  1. Only an admin writes the text, and every save is a new version. Versions
     are immutable once published because an acceptance row points at the
     exact version the host saw; editing it in place would change what people
     had "signed".

  2. Signing is per listing and per version. A listing may be submitted only
     with an acceptance of the *active* version, so when the admin publishes
     new terms every host signs again on their next submission — nobody is
     bound by text they never saw.
*/

const ACCEPTANCE_SELECT = {
  id: true,
  signatureName: true,
  acceptedAt: true,
  ipAddress: true,
  agreement: { select: { id: true, version: true, title: true } },
  user: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class AgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The version hosts are asked to sign right now. */
  async active() {
    const agreement = await this.prisma.hostAgreement.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!agreement) {
      // The migration seeds version 1, so this means the table was emptied.
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'No host agreement has been published yet.',
      });
    }
    return agreement;
  }

  /**
   * What the listing wizard needs: the active text, and whether this listing
   * has already been signed against it.
   */
  async forHost(user: RequestUser, propertyId?: string) {
    const agreement = await this.active();
    const acceptance = propertyId
      ? await this.prisma.hostAgreementAcceptance.findFirst({
          where: {
            agreementId: agreement.id,
            propertyId,
            // A signature on someone else's listing is not this host's.
            userId: user.id,
          },
          select: ACCEPTANCE_SELECT,
        })
      : null;
    return {
      agreement: {
        id: agreement.id,
        version: agreement.version,
        title: agreement.title,
        body: agreement.body,
        publishedAt: agreement.createdAt,
      },
      acceptance,
    };
  }

  async sign(
    user: RequestUser,
    dto: SignAgreementDto,
    context: { ipAddress?: string; userAgent?: string },
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      select: { id: true, ownerId: true, deletedAt: true },
    });
    if (!property || property.deletedAt) {
      throw new NotFoundException({
        errorCode: ErrorCodes.PROPERTY_NOT_FOUND,
        message: 'Property not found.',
      });
    }
    if (property.ownerId !== user.id && user.role !== UserRoles.ADMIN) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.FORBIDDEN,
        message: 'Only the owner of this listing can sign for it.',
      });
    }

    const signatureName = dto.signatureName.trim().replace(/\s+/g, ' ');
    if (signatureName.length < 3) {
      throw new BadRequestException({
        errorCode: ErrorCodes.VALIDATION_ERROR,
        message: 'Type your full name as your signature.',
      });
    }

    const agreement = await this.active();

    // Signing twice against the same version is a no-op that returns the
    // original record — the first signature is the one that counts.
    const existing = await this.prisma.hostAgreementAcceptance.findUnique({
      where: {
        agreementId_propertyId: {
          agreementId: agreement.id,
          propertyId: property.id,
        },
      },
      select: ACCEPTANCE_SELECT,
    });
    if (existing) {
      return { acceptance: existing, alreadySigned: true };
    }

    const acceptance = await this.prisma.hostAgreementAcceptance.create({
      data: {
        agreementId: agreement.id,
        userId: user.id,
        propertyId: property.id,
        signatureName,
        ipAddress: context.ipAddress?.slice(0, 64),
        userAgent: context.userAgent?.slice(0, 250),
      },
      select: ACCEPTANCE_SELECT,
    });

    await this.audit.record({
      actorId: user.id,
      action: AuditActions.HOST_AGREEMENT_SIGNED,
      entityType: 'Property',
      entityId: property.id,
      metadata: {
        agreementVersion: agreement.version,
        signatureName,
      },
    });

    return { acceptance, alreadySigned: false };
  }

  /**
   * The gate the properties service calls before a listing may enter the
   * approval queue. Throws a readable 400 rather than returning false, so the
   * wizard can show the host exactly what is missing.
   */
  async assertSignedForSubmission(userId: string, propertyId: string) {
    const agreement = await this.active();
    const acceptance = await this.prisma.hostAgreementAcceptance.findFirst({
      where: { agreementId: agreement.id, propertyId, userId },
      select: { id: true },
    });
    if (!acceptance) {
      throw new BadRequestException({
        errorCode: ErrorCodes.AGREEMENT_REQUIRED,
        message: `Please read and sign the ${agreement.title} (version ${agreement.version}) before submitting this listing for approval.`,
      });
    }
  }

  // --- Admin -----------------------------------------------------------------

  /** Active version plus the full history, newest first. */
  async adminView() {
    const versions = await this.prisma.hostAgreement.findMany({
      orderBy: { version: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { acceptances: true } },
      },
    });
    return {
      active: versions.find((v) => v.isActive) ?? null,
      versions,
    };
  }

  /**
   * Publishes a new version and makes it the one hosts sign. Done in one
   * transaction so there is never a moment with two active versions, or none.
   */
  async publish(actorId: string, dto: PublishAgreementDto) {
    const title = dto.title.trim();
    const body = dto.body.replace(/\r\n/g, '\n').trim();

    const published = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.hostAgreement.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true, title: true, body: true },
      });
      // Re-saving identical text would only create a version that forces
      // every host to sign again for nothing.
      if (latest && latest.title === title && latest.body === body) {
        throw new BadRequestException({
          errorCode: ErrorCodes.VALIDATION_ERROR,
          message:
            'This is identical to the current version. Nothing was published.',
        });
      }
      await tx.hostAgreement.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return tx.hostAgreement.create({
        data: {
          version: (latest?.version ?? 0) + 1,
          title,
          body,
          isActive: true,
          createdById: actorId,
        },
      });
    });

    await this.audit.record({
      actorId,
      action: AuditActions.HOST_AGREEMENT_PUBLISHED,
      entityType: 'HostAgreement',
      entityId: published.id,
      metadata: { version: published.version, title },
    });

    return published;
  }

  /** For the admin's property review page: who signed, when, which version. */
  async acceptanceForProperty(propertyId: string) {
    const active = await this.prisma.hostAgreement.findFirst({
      where: { isActive: true },
      select: { id: true, version: true },
    });
    const latest = await this.prisma.hostAgreementAcceptance.findFirst({
      where: { propertyId },
      orderBy: { acceptedAt: 'desc' },
      select: ACCEPTANCE_SELECT,
    });
    return {
      acceptance: latest,
      // True only if the signature is against the text currently in force.
      current: Boolean(latest && active && latest.agreement.id === active.id),
      activeVersion: active?.version ?? null,
    };
  }
}
