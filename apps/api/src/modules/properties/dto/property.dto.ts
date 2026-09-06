import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PropertyStatus, PropertyType } from '@prisma/client';

export class PropertyImageInputDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  publicId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}

export class CreatePropertyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  description!: string;

  @IsEnum(PropertyType)
  propertyType!: PropertyType;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  location!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  state!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address!: string;

  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCapacity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  bedrooms!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  bathrooms!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weekendPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  extraGuestCharge?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  partyRules?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  propertyRules?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  cancellationPolicy?: string;

  @IsOptional()
  @IsBoolean()
  isPartyFriendly?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  amenityIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  images?: PropertyImageInputDto[];
}

export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCapacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bathrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weekendPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  extraGuestCharge?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  partyRules?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  propertyRules?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  cancellationPolicy?: string;

  @IsOptional()
  @IsBoolean()
  isPartyFriendly?: boolean;

  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  amenityIds?: string[];
}

export class ListPropertiesQueryDto {
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
  city?: string;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc', 'rating'])
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating';
}
