import {
  IsEmail,
  IsEnum,
  IsIn,
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

  /*
    PhonePe Payment Gateway (Standard Checkout v2). Optional at boot so the
    rest of the API can run without a gateway — the checkout page then reports
    payments as not configured — but the client id and secret are needed to
    take a payment, and the webhook username and password to accept webhooks.
    PHONEPE_ENV picks the host: PRODUCTION credentials are refused by the
    sandbox and the other way round.
  */
  @IsOptional()
  @IsIn(['PRODUCTION', 'SANDBOX'])
  PHONEPE_ENV?: string;

  @IsOptional()
  @IsString()
  PHONEPE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  PHONEPE_CLIENT_SECRET?: string;

  /** The client version shown next to the credentials; usually 1. */
  @IsOptional()
  @IsString()
  PHONEPE_CLIENT_VERSION?: string;

  /** The pair set on the webhook in the PhonePe dashboard. */
  @IsOptional()
  @IsString()
  PHONEPE_WEBHOOK_USERNAME?: string;

  @IsOptional()
  @IsString()
  PHONEPE_WEBHOOK_PASSWORD?: string;

  /*
    WhatsApp Cloud API (Meta). Optional: without the token and phone number id
    nothing is sent on WhatsApp and every other channel works as before. Only
    approved templates are sent, and only to users who verified their phone
    and opted in — see docs/whatsapp.md.
  */
  @IsOptional()
  @IsString()
  WHATSAPP_ACCESS_TOKEN?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_PHONE_NUMBER_ID?: string;

  /** Graph API version, e.g. v21.0. */
  @IsOptional()
  @IsString()
  WHATSAPP_API_VERSION?: string;

  /** The language the templates were approved in; "en" by default. */
  @IsOptional()
  @IsString()
  WHATSAPP_TEMPLATE_LANGUAGE?: string;

  /**
   * Where the gateway sends the browser back after checkout, and where it
   * posts webhooks. Both default to routes on `${WEB_APP_URL}/api/payments/…`,
   * which the site proxies to this server — set them only if that proxy is
   * not in place.
   */
  @IsOptional()
  @IsString()
  PAYMENT_RETURN_URL?: string;

  @IsOptional()
  @IsString()
  PAYMENT_WEBHOOK_URL?: string;

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
  GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  GOOGLE_OAUTH_REDIRECT_URI?: string;

  @IsOptional()
  @IsString()
  WEB_APP_URL?: string;

  /**
   * Redis, for OTP state and the email/WhatsApp delivery queue. Unset, OTPs
   * use an in-memory store and messages are sent in-process without retries.
   */
  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  /**
   * "off" stops this process from sending queued messages (it still queues
   * them). Only for running several API instances with one sender.
   */
  @IsOptional()
  @IsIn(['on', 'off'])
  DELIVERY_WORKER?: string;

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
  RENFLAIR_API_KEY?: string;

  /**
   * Email. All optional: with no MAIL_PROVIDER the console transport is used,
   * which logs messages instead of sending them. The transport itself checks
   * that host, user and password are present before choosing SMTP, so a half
   * filled block degrades to logging rather than failing at send time.
   */
  /**
   * How many reverse proxies sit in front of the API. 0 when it is exposed
   * directly, 1 behind a single Nginx. Anything above the real number lets a
   * caller forge X-Forwarded-For and choose their own rate-limit bucket.
   */
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === '' ? undefined : Number(value),
  )
  @IsInt()
  @Min(0)
  TRUST_PROXY_HOPS?: number;

  @IsOptional()
  @IsString()
  MAIL_PROVIDER?: string;

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === '' ? undefined : Number(value),
  )
  @IsInt()
  @Min(1)
  SMTP_PORT?: number;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM_NAME?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM_ADDRESS?: string;

  /*
    Where "a host submitted a listing" mail goes. Optional on purpose: when it
    is unset the address falls back to MAIL_FROM_ADDRESS, which on every
    deployment so far is the same shared inbox. That keeps the notification
    working without a server-side config change, while leaving a way to split
    the two later.
  */
  @IsOptional()
  @IsEmail()
  ADMIN_NOTIFICATION_EMAIL?: string;

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

  @IsOptional()
  @IsString()
  ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  ADMIN_PASSWORD?: string;

  @IsOptional()
  @IsString()
  ADMIN_NAME?: string;
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

  if (validated.NODE_ENV === 'production') {
    if (!validated.COOKIE_SECURE) {
      throw new Error(
        'Invalid environment configuration: COOKIE_SECURE must be true in production.',
      );
    }
    const placeholder = /replace-with-a-long-random/;
    if (
      placeholder.test(validated.JWT_ACCESS_SECRET) ||
      placeholder.test(validated.JWT_REFRESH_SECRET)
    ) {
      throw new Error(
        'Invalid environment configuration: JWT secrets must not use example placeholder values in production.',
      );
    }
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
