import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone must be a valid 10-digit Indian mobile number.',
  })
  phone!: string;

  @IsOptional()
  @IsIn(['LOGIN', 'REGISTER'])
  purpose?: 'LOGIN' | 'REGISTER';
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone must be a valid 10-digit Indian mobile number.',
  })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit code.' })
  code!: string;

  @IsOptional()
  @IsIn(['LOGIN', 'REGISTER'])
  purpose?: 'LOGIN' | 'REGISTER';

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;
}
