import { Logger } from '@nestjs/common';
import { maskPhone } from './console-sms.provider';
import type {
  OtpDelivery,
  SendSmsInput,
  SmsProvider,
} from './sms-provider.interface';

/**
 * WhatsApp first, SMS as the safety net.
 *
 * Codes go out on WhatsApp unless the person asked for SMS ("Send by SMS
 * instead" on the sign-in form). If the WhatsApp send fails — the gateway is
 * down, out of balance, or refuses the number — the same code goes by SMS
 * straight away, so nobody is left waiting for a message that is not coming.
 *
 * An accepted WhatsApp send does not prove the number uses WhatsApp; that is
 * what the SMS option on the resend step is for.
 */
export class OtpChannelRouter implements SmsProvider {
  readonly name: string;
  private readonly logger = new Logger(OtpChannelRouter.name);

  constructor(
    private readonly whatsapp: SmsProvider,
    private readonly sms: SmsProvider,
  ) {
    this.name = `${whatsapp.name}+${sms.name}`;
  }

  async send(input: SendSmsInput): Promise<OtpDelivery> {
    if (input.channel !== 'sms') {
      try {
        await this.whatsapp.send(input);
        return { channel: 'whatsapp' };
      } catch {
        this.logger.warn(
          `WhatsApp code to ${maskPhone(input.phone)} failed; sending it by SMS instead.`,
        );
      }
    }
    await this.sms.send(input);
    return { channel: 'sms' };
  }
}
