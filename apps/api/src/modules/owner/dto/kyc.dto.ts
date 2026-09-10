import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RequestHostPhoneOtpDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number.',
  })
  phone!: string;
}

export class VerifyHostPhoneOtpDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number.',
  })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit code.' })
  code!: string;
}

export class SubmitHostKycDto {
  // Checked properly (length, prefix and Verhoeff checksum) in the service.
  @IsString()
  @MaxLength(20)
  aadhaarNumber!: string;

  @IsString()
  @MaxLength(500)
  aadhaarImageUrl!: string;

  @IsString()
  @MaxLength(12)
  panNumber!: string;

  @IsString()
  @MaxLength(500)
  panImageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  businessName?: string;
}

export class SaveBankAccountDto {
  @IsString()
  @MaxLength(120)
  accountHolderName!: string;

  // Length and shape are checked in the service.
  @IsString()
  @MaxLength(30)
  accountNumber!: string;

  @IsString()
  @MaxLength(15)
  ifsc!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;
}
