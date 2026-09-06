import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { maskPhone } from './console-sms.provider';
import type { SendSmsInput, SmsProvider } from './sms-provider.interface';

@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  private readonly logger = new Logger(TwilioSmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendSmsInput): Promise<void> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_FROM_NUMBER');
    if (!sid || !token || !from) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.SMS_PROVIDER_ERROR,
        message: 'SMS provider is not configured.',
      });
    }

    const to = input.phone.startsWith('+') ? input.phone : `+91${input.phone}`;
    const body = new URLSearchParams({
      To: to,
      From: from,
      Body: input.message,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    if (!response.ok) {
      this.logger.warn(`SMS send failed for ${maskPhone(input.phone)}`);
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.SMS_PROVIDER_ERROR,
        message: 'Unable to send SMS right now.',
      });
    }
  }
}
