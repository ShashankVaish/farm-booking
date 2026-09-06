import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { BookingStatus, PropertyStatus, UserRole } from '@prisma/client';

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
