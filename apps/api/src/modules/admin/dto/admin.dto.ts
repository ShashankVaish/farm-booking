import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  BookingStatus,
  PropertyStatus,
  SupportTicketStatus,
  UserRole,
} from '@prisma/client';

export class AdminListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  q?: string;
}

export class AdminUsersQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(['CUSTOMER', 'OWNER', 'ADMIN'] as const)
  role?: UserRole;

  @IsOptional()
  @IsEnum(['ACTIVE', 'DISABLED'] as const)
  status?: 'ACTIVE' | 'DISABLED';

  @IsOptional()
  @IsDateString()
  registeredFrom?: string;

  @IsOptional()
  @IsDateString()
  registeredTo?: string;
}

export class AdminPropertiesQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;
}

export class AdminPaymentsQueryDto extends AdminListQueryDto {
  /** Only rows created within this many hours. Omit for all history. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  hours?: number;
}

export class AdminBookingsQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}

export class AdminReportsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class PropertyModerationDto {
  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  reason!: string;
}

export class SetUserActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class ModerateReviewDto {
  @IsBoolean()
  isPublished!: boolean;
}

export class UpdateSupportTicketDto {
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;
}

export class AdminRefundDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @Type(() => Number)
  amount?: number;
}

export class AdminCancelBookingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  /** Also mark the freed nights unavailable instead of reselling them. */
  @IsOptional()
  @IsBoolean()
  blockDates?: boolean;
}

export class AdminPayoutsQueryDto {
  /**
   * Optional window end date (YYYY-MM-DD). Only applied together with `days`.
   * With neither set the statement covers everything still owed.
   */
  @IsOptional()
  @IsDateString()
  date?: string;

  /** Optional window length in days. Omit for the full outstanding ledger. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;
}

export class UpdatePlatformSettingsDto {
  /** Platform commission in basis points (500 = 5%). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  platformFeeBps?: number;

  /** Minutes an unpaid booking holds its dates before expiring. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  bookingExpireMinutes?: number;
}
