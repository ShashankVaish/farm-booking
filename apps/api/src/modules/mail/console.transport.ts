import { Injectable, Logger } from '@nestjs/common';
import type { MailTransport, OutboundEmail } from './mail-transport.interface';
import { maskEmail } from './smtp.transport';

/**
 * Logs the message instead of sending it.
 *
 * This is the transport used by tests and by a dev machine with no SMTP
 * credentials. It logs the plain-text body in full on purpose: during
 * development the signup code has to be readable somewhere, and the alternative
 * — a silent no-op — is exactly how the SMS provider once swallowed every OTP.
 */
@Injectable()
export class ConsoleMailTransport implements MailTransport {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleMailTransport.name);

  send(email: OutboundEmail): Promise<void> {
    this.logger.log(
      `[not sent] to=${maskEmail(email.to)} subject="${email.subject}"\n${email.text}`,
    );
    return Promise.resolve();
  }
}
