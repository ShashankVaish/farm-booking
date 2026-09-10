import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class RequestEmailOtpDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255)
  email!: string;
}

export class VerifyEmailOtpDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'The code must be 6 digits.' })
  code!: string;
}
