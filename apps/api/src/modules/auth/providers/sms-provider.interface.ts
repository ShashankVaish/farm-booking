/** Where a verification code is delivered. */
export type OtpChannel = 'whatsapp' | 'sms';

/** What actually carried the code, for telling the person where to look. */
export interface OtpDelivery {
  channel: OtpChannel;
}

export interface SendSmsInput {
  phone: string;
  /**
   * Where the person wants the code. Only the WhatsApp-first router reads
   * it; a plain SMS provider always sends SMS.
   */
  channel?: OtpChannel;
  /** Fully rendered message, used by providers that send free text. */
  message: string;
  /**
   * The bare verification code.
   *
   * OTP-only gateways (Renflair, and most Indian non-DLT providers) take the
   * code as a parameter and render the message themselves from an approved
   * template, so they cannot use `message`. Passing it separately avoids
   * scraping the digits back out of the sentence, which would silently break
   * the moment that wording changes.
   */
  code?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(input: SendSmsInput): Promise<void | OtpDelivery>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
