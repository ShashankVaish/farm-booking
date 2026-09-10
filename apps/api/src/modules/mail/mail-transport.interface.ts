/** A fully rendered message, ready to hand to a transport. */
export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  /**
   * Plain-text alternative. Always sent alongside the HTML: some clients show
   * it instead, and a message with no text part scores badly with spam filters.
   */
  text: string;
}

export interface MailTransport {
  readonly name: string;
  /**
   * Delivers the message, or throws. Callers decide whether a failure should
   * surface — for notifications it must not, since a booking is still valid
   * whether or not the receipt arrived.
   */
  send(email: OutboundEmail): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
