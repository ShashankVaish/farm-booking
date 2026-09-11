import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MAIL_TRANSPORT,
  type MailTransport,
  type OutboundEmail,
} from './mail-transport.interface';
import { SmtpMailTransport, maskEmail } from './smtp.transport';

@Injectable()
export class MailService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly config: ConfigService,
  ) {}

  /**
   * Authenticates against the mail server at boot.
   *
   * Bad credentials otherwise stay invisible until the first person tries to
   * sign up, and then look like a broken signup rather than a broken mailbox.
   * This never blocks startup — the rest of the API works fine without email.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!(this.transport instanceof SmtpMailTransport)) {
      this.logger.warn(
        `Mail transport is "${this.transport.name}" — messages will be logged, not delivered.`,
      );
      return;
    }
    try {
      await this.transport.verify();
      this.logger.log(
        `SMTP ready as ${maskEmail(this.config.get<string>('SMTP_USER') ?? '')}.`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `SMTP login was REJECTED by ${this.config.get<string>('SMTP_HOST')}: ${
          error instanceof Error ? error.message : 'unknown error'
        }. Signup codes and booking emails will not be delivered until SMTP_USER and SMTP_PASS are correct.`,
      );
    }
  }

  get providerName(): string {
    return this.transport.name;
  }

  brandName(): string {
    return (this.config.get<string>('MAIL_FROM_NAME') ?? '').trim() || 'Baagly';
  }

  /**
   * The inbox that operational alerts go to — a new listing awaiting review,
   * for example.
   *
   * Falls back to the from-address because on every deployment so far they are
   * the same shared mailbox, so the alert works out of the box rather than
   * silently going nowhere until someone sets one more variable. Returns null
   * only when neither is configured, which callers treat as "no alerts".
   */
  adminAddress(): string | null {
    const explicit = this.config
      .get<string>('ADMIN_NOTIFICATION_EMAIL')
      ?.trim();
    if (explicit) return explicit;
    const from = this.config.get<string>('MAIL_FROM_ADDRESS')?.trim();
    return from || null;
  }

  /** Base URL for links in emails; the guest has to be able to click through. */
  webUrl(): string {
    const raw =
      this.config.get<string>('WEB_APP_URL') ??
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ??
      'http://localhost:3000';
    return raw.replace(/\/$/, '');
  }

  /**
   * Delivers a message, throwing on failure.
   *
   * Use this only where the caller genuinely cannot continue without the mail —
   * signup, where the code is the whole point of the request. Everything else
   * should use `sendQuietly`.
   */
  async send(email: OutboundEmail): Promise<void> {
    await this.transport.send(email);
  }

  /**
   * Delivers a message, swallowing any failure after logging it.
   *
   * A confirmation email is a side effect of a booking, not part of it. If
   * Titan is down, the guest has still paid and the stay is still confirmed, so
   * throwing here would roll back or 500 a request that actually succeeded.
   * The failure is logged at error level so it is still visible.
   */
  async sendQuietly(email: OutboundEmail): Promise<boolean> {
    try {
      await this.transport.send(email);
      return true;
    } catch (error: unknown) {
      this.logger.error(
        `Could not email ${maskEmail(email.to)} ("${email.subject}"): ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return false;
    }
  }
}
