import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleMailTransport } from './console.transport';
import { MAIL_TRANSPORT } from './mail-transport.interface';
import { MailService } from './mail.service';
import { SmtpMailTransport } from './smtp.transport';

/**
 * Global so auth, bookings and payments can all send without each module
 * re-importing it. There is exactly one transport per process.
 */
@Global()
@Module({
  providers: [
    ConsoleMailTransport,
    SmtpMailTransport,
    {
      /**
       * MAIL_PROVIDER picks the transport. `smtp` falls back to the console
       * transport when credentials are missing rather than booting an API that
       * throws on the first signup — but it says so loudly, because silently
       * logging codes instead of sending them is precisely how OTP delivery
       * broke before.
       */
      provide: MAIL_TRANSPORT,
      inject: [ConfigService, ConsoleMailTransport, SmtpMailTransport],
      useFactory: (
        config: ConfigService,
        consoleMail: ConsoleMailTransport,
        smtp: SmtpMailTransport,
      ) => {
        const logger = new Logger('MailTransport');
        const choice = (config.get<string>('MAIL_PROVIDER') ?? 'console')
          .trim()
          .toLowerCase();

        if (choice === 'smtp') {
          if (smtp.isConfigured()) return smtp;
          logger.error(
            'MAIL_PROVIDER=smtp but SMTP_HOST, SMTP_USER or SMTP_PASS is missing — falling back to the console transport. Emails will be logged, not sent.',
          );
          return consoleMail;
        }

        if (choice !== 'console') {
          logger.warn(
            `Unknown MAIL_PROVIDER "${choice}" — falling back to the console transport. Emails will be logged, not sent.`,
          );
        }
        return consoleMail;
      },
    },
    MailService,
  ],
  exports: [MailService, MAIL_TRANSPORT, SmtpMailTransport],
})
export class MailModule {}
