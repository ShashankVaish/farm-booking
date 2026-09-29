import { BookingSlot } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  propertyId!: string;

  @IsDateString()
  checkInDate!: string;

  @IsDateString()
  checkOutDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  guestCount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;

  /** Day party, night party or (the default) an overnight stay. */
  @IsOptional()
  @IsEnum(BookingSlot)
  slot?: BookingSlot;
}

export class QuoteBookingDto {
  @IsUUID()
  propertyId!: string;

  @IsDateString()
  checkInDate!: string;

  @IsDateString()
  checkOutDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  guestCount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;

  /** Day party, night party or (the default) an overnight stay. */
  @IsOptional()
  @IsEnum(BookingSlot)
  slot?: BookingSlot;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
