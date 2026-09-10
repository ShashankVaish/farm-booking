export interface SendSmsInput {
  phone: string;
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
  send(input: SendSmsInput): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
