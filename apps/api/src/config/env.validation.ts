import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import { plainToInstance, Transform } from 'class-transformer';

export class EnvironmentVariables {
  @IsEnum(['development', 'test', 'production'])
  NODE_ENV!: 'development' | 'test' | 'production';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(10)
  BCRYPT_ROUNDS!: number;

  COOKIE_SECURE!: boolean;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1000)
  THROTTLE_TTL_MS!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1000)
  AUTH_THROTTLE_TTL_MS!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  AUTH_THROTTLE_LIMIT!: number;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  @IsOptional()
  @IsString()
  RAZORPAY_KEY_ID?: string;

  @IsOptional()
  @IsString()
  RAZORPAY_KEY_SECRET?: string;

  @IsOptional()
  @IsString()
  RAZORPAY_WEBHOOK_SECRET?: string;

  @Transform(({ value }) => Number(value ?? 500))
  @IsInt()
  @Min(0)
  PLATFORM_FEE_BPS!: number;

  @IsOptional()
  @IsString()
  GEOCODING_PROVIDER?: string;

  @IsOptional()
  @IsString()
  GOOGLE_MAPS_API_KEY?: string;

  @IsOptional()
  @IsString()
  SMS_PROVIDER?: string;

  @IsOptional()
  @IsString()
  TWILIO_ACCOUNT_SID?: string;

  @IsOptional()
  @IsString()
  TWILIO_AUTH_TOKEN?: string;

  @IsOptional()
  @IsString()
  TWILIO_FROM_NUMBER?: string;

  @IsOptional()
  @IsString()
  OTP_PEPPER?: string;

  @Transform(({ value }) => Number(value ?? 300))
  @IsInt()
  @Min(30)
  OTP_TTL_SECONDS!: number;

  @Transform(({ value }) => Number(value ?? 60))
  @IsInt()
  @Min(10)
  OTP_RESEND_COOLDOWN_SECONDS!: number;

  @Transform(({ value }) => Number(value ?? 5))
  @IsInt()
  @Min(1)
  OTP_MAX_ATTEMPTS!: number;

  @Transform(({ value }) => Number(value ?? 5))
  @IsInt()
  @Min(1)
  OTP_MAX_SENDS_PER_HOUR!: number;

  @Transform(({ value }) => Number(value ?? 30))
  @IsInt()
  @Min(5)
  BOOKING_EXPIRE_MINUTES!: number;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const normalized: Record<string, unknown> = {
    ...config,
    COOKIE_SECURE:
      config.COOKIE_SECURE === true ||
      config.COOKIE_SECURE === 'true' ||
      config.COOKIE_SECURE === '1',
    PLATFORM_FEE_BPS: config.PLATFORM_FEE_BPS ?? 500,
    OTP_TTL_SECONDS: config.OTP_TTL_SECONDS ?? 300,
    OTP_RESEND_COOLDOWN_SECONDS: config.OTP_RESEND_COOLDOWN_SECONDS ?? 60,
    OTP_MAX_ATTEMPTS: config.OTP_MAX_ATTEMPTS ?? 5,
    OTP_MAX_SENDS_PER_HOUR: config.OTP_MAX_SENDS_PER_HOUR ?? 5,
    BOOKING_EXPIRE_MINUTES: config.BOOKING_EXPIRE_MINUTES ?? 30,
  };

  const validated = plainToInstance(EnvironmentVariables, normalized, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  return validated;
}

export function parseCorsOrigins(origins: string): string[] {
  const listed = origins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const extras: string[] = [];
  for (const origin of listed) {
    if (origin.includes('://localhost')) {
      extras.push(origin.replace('://localhost', '://127.0.0.1'));
    }
    if (origin.includes('://127.0.0.1')) {
      extras.push(origin.replace('://127.0.0.1', '://localhost'));
    }
  }

  return [...new Set([...listed, ...extras])];
}
