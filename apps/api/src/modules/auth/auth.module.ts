import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { ConsoleSmsProvider } from './providers/console-sms.provider';
import { SMS_PROVIDER } from './providers/sms-provider.interface';
import { RenflairSmsProvider } from './providers/renflair-sms.provider';
import { TwilioSmsProvider } from './providers/twilio-sms.provider';
import { TokenService } from './token.service';
import { MemoryOtpStore } from './otp/memory-otp.store';
import { OTP_STORE } from './otp/otp-store';
import { RedisOtpStore } from './otp/redis-otp.store';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as
            `${number}m` | `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminBootstrapService,
    PasswordService,
    TokenService,
    JwtStrategy,
    ConsoleSmsProvider,
    TwilioSmsProvider,
    RenflairSmsProvider,
    {
      /**
       * SMS_PROVIDER picks the gateway. Anything unrecognised falls back to the
       * console provider, which logs the code instead of sending it — safe for
       * development, and obvious in the logs if it is ever hit in production.
       */
      provide: SMS_PROVIDER,
      inject: [
        ConfigService,
        ConsoleSmsProvider,
        TwilioSmsProvider,
        RenflairSmsProvider,
      ],
      useFactory: (
        config: ConfigService,
        consoleSms: ConsoleSmsProvider,
        twilio: TwilioSmsProvider,
        renflair: RenflairSmsProvider,
      ) => {
        const choice = (config.get<string>('SMS_PROVIDER') ?? 'console')
          .trim()
          .toLowerCase();
        if (choice === 'twilio') return twilio;
        if (choice === 'renflair') return renflair;
        if (choice !== 'console') {
          new Logger('SmsProvider').warn(
            `Unknown SMS_PROVIDER "${choice}" — falling back to the console provider. Codes will be logged, not sent.`,
          );
        }
        return consoleSms;
      },
    },
    {
      /**
       * Redis when REDIS_URL is set, otherwise a process-local store so the
       * API still boots for a developer without Docker. The fallback is single
       * process by nature, so it is logged loudly rather than passing silently.
       */
      provide: OTP_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (!url) {
          new Logger('OtpStore').warn(
            'REDIS_URL is not set — using an in-memory OTP store. Codes will not survive a restart and will not work across multiple API instances.',
          );
          return new MemoryOtpStore();
        }
        const client = new Redis(url, {
          // Fail a request rather than queue it forever if Redis is down; the
          // caller sees an error instead of a hung sign-in.
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
        });
        client.on('error', (error: Error) => {
          new Logger('OtpStore').error(`Redis error: ${error.message}`);
        });
        return new RedisOtpStore(client);
      },
    },
    OtpService,
  ],
  exports: [AuthService, PasswordService, OtpService],
})
export class AuthModule {}
