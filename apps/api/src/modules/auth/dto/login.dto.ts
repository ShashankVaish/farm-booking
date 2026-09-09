import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$|^[a-zA-Z0-9._-]+$/, {
    message: 'Enter an email address or admin login.',
  })
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
