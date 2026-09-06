import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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
}

export class AdminPropertiesQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;
}

export class AdminBookingsQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}

export class RejectPropertyDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
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
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
