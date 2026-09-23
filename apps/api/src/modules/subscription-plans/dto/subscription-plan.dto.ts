import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Blank lines from the admin's textarea are dropped rather than rejected.
const trimFeatures = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? (value as unknown[])
        .map((item) => (typeof item === 'string' ? item.trim() : item))
        .filter((item) => item !== '')
    : value;

export class CreateSubscriptionPlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyPrice!: number;

  // Omitted or null means unlimited listings.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  listingLimit?: number | null;

  @IsOptional()
  @Transform(trimFeatures)
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSubscriptionPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyPrice?: number;

  // null switches the plan to unlimited listings.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  listingLimit?: number | null;

  @IsOptional()
  @Transform(trimFeatures)
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
