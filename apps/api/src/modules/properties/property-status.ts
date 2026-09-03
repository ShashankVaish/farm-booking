import { PropertyStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { ErrorCodes } from '../../common/constants/error-codes';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';

const OWNER_STATUSES = new Set<PropertyStatus>([
  PropertyStatus.DRAFT,
  PropertyStatus.PENDING_APPROVAL,
]);

const ADMIN_STATUSES = new Set<PropertyStatus>(Object.values(PropertyStatus));

export function assertPropertyStatusTransition(
  current: PropertyStatus,
  next: PropertyStatus,
  user: RequestUser,
): void {
  if (user.role === UserRoles.ADMIN) {
    if (!ADMIN_STATUSES.has(next)) {
      throw invalid();
    }
    return;
  }

  if (user.role !== UserRoles.OWNER) {
    throw invalid();
  }

  if (!OWNER_STATUSES.has(next)) {
    throw invalid();
  }

  const allowedFrom: Record<PropertyStatus, PropertyStatus[]> = {
    DRAFT: [PropertyStatus.DRAFT, PropertyStatus.PENDING_APPROVAL],
    PENDING_APPROVAL: [PropertyStatus.DRAFT, PropertyStatus.PENDING_APPROVAL],
    REJECTED: [PropertyStatus.DRAFT, PropertyStatus.PENDING_APPROVAL],
    APPROVED: [],
    SUSPENDED: [],
  };

  if (!allowedFrom[current].includes(next)) {
    throw invalid();
  }
}

function invalid(): ForbiddenException {
  return new ForbiddenException({
    errorCode: ErrorCodes.INVALID_STATUS_TRANSITION,
    message: 'This property status transition is not allowed.',
  });
}

export function canManageProperty(ownerId: string, user: RequestUser): boolean {
  return user.role === UserRoles.ADMIN || ownerId === user.id;
}
