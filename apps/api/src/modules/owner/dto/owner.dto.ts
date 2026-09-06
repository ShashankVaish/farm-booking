import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateOwnerProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gstNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  panNumber?: string;
}
