import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class RequestPhoneVerificationDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number.',
  })
  phone!: string;
}

export class VerifyPhoneDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number.',
  })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit code.' })
  code!: string;

  /** The customer's explicit choice to get booking updates on WhatsApp. */
  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;
}

export class RequestEmailVerificationDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;
}

export class VerifyEmailDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'The code has 6 digits.' })
  code!: string;
}
