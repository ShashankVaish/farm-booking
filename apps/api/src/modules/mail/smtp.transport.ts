import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailTransport, OutboundEmail } from './mail-transport.interface';

/**
 * Real delivery over SMTP.
 *
 * The transporter is built once and reused: nodemailer pools connections, and
 * opening a fresh TLS session per message is both slow and a good way to get
 * rate-limited by a shared host like Titan.
 */
@Injectable()
export class SmtpMailTransport implements MailTransport {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpMailTransport.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  /** True only when every value needed to open a session is present. */
  isConfigured(): boolean {
    return Boolean(this.host() && this.user() && this.pass());
  }

  private host(): string {
    return (this.config.get<string>('SMTP_HOST') ?? '').trim();
  }

  private user(): string {
    return (this.config.get<string>('SMTP_USER') ?? '').trim();
  }

  private pass(): string {
    return this.config.get<string>('SMTP_PASS') ?? '';
  }

  private port(): number {
    const raw = Number(this.config.get<string>('SMTP_PORT') ?? 465);
    return Number.isFinite(raw) && raw > 0 ? raw : 465;
  }

  private client(): Transporter {
    if (this.transporter) return this.transporter;

    const port = this.port();
    this.transporter = createTransport({
      host: this.host(),
      port,
      // 465 is implicit TLS. Every other port starts in the clear and upgrades
      // with STARTTLS, which nodemailer does on its own when `secure` is false.
      secure: port === 465,
      auth: { user: this.user(), pass: this.pass() },
      pool: true,
      maxConnections: 3,
    });
    return this.transporter;
  }

  async send(email: OutboundEmail): Promise<void> {
    const from = this.from();
    await this.client().sendMail({
      from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    this.logger.log(
      `Sent "${maskSubject(email.subject)}" to ${maskEmail(email.to)}`,
    );
  }

  private from(): string {
    const address =
      (this.config.get<string>('MAIL_FROM_ADDRESS') ?? '').trim() ||
      this.user();
    const name = (this.config.get<string>('MAIL_FROM_NAME') ?? '').trim();
    return name ? `"${name}" <${address}>` : address;
  }

  /**
   * Opens a session and authenticates without sending anything. Used by the
   * health check so a bad password is found on purpose rather than by noticing
   * that guests stopped receiving confirmations.
   */
  async verify(): Promise<void> {
    await this.client().verify();
  }
}

/**
 * Hides anything code-shaped in a logged subject line.
 *
 * The signup subject is "482913 is your Baagly verification code", so logging
 * it verbatim wrote live one-time codes into the application log at info level
 * — readable by anyone who can see the logs, which defeats the point of sending
 * the code to an inbox at all. The rest of the subject is kept because it is
 * what makes the line useful when tracing a delivery.
 */
export function maskSubject(subject: string): string {
  return subject.replace(/\d{4,}/g, (run) => '*'.repeat(run.length));
}

/**
 * Addresses end up in application logs, so only enough is kept to tell two
 * recipients apart while debugging.
 */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = address.slice(0, at);
  const domain = address.slice(at);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local.slice(0, 2)}***${domain}`;
}
