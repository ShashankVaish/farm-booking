import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { maskPhone } from './console-sms.provider';
import { isAccepted, normalizeIndianMobile } from './renflair-sms.provider';
import type {
  OtpDelivery,
  SendSmsInput,
  SmsProvider,
} from './sms-provider.interface';

const ENDPOINT = 'https://whatsapp.renflair.in/V1.php';
const TIMEOUT_MS = 12_000;

/**
 * Renflair's WhatsApp OTP ("Code for sending text OTP" in their dashboard).
 *
 *   GET https://whatsapp.renflair.in/V1.php?API=<key>&PHONE=<10 digits>&OTP=<code>&COUNTRY=91
 *
 * Renflair sends it from its own approved WhatsApp template ("OTP Code: … This
 * is your OTP code for <app>. For Security, do not share the code."), so like
 * the SMS gateway it takes the bare code and ignores `message`. The key is a
 * separate one from the SMS key: RENFLAIR_WHATSAPP_API_KEY.
 */
@Injectable()
export class RenflairWhatsAppOtpProvider implements SmsProvider {
  readonly name = 'renflair-whatsapp';
  private readonly logger = new Logger(RenflairWhatsAppOtpProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('RENFLAIR_WHATSAPP_API_KEY'));
  }

  async send(input: SendSmsInput): Promise<OtpDelivery> {
    const apiKey = this.config.get<string>('RENFLAIR_WHATSAPP_API_KEY');
    const phone = normalizeIndianMobile(input.phone);
    if (!apiKey || !input.code || !phone) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.SMS_PROVIDER_ERROR,
        message: 'WhatsApp codes are not available for this number.',
      });
    }

    const url = new URL(ENDPOINT);
    url.searchParams.set('API', apiKey);
    url.searchParams.set('PHONE', phone);
    url.searchParams.set('OTP', input.code);
    url.searchParams.set('COUNTRY', '91');

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      this.logger.warn(
        `Renflair WhatsApp timed out sending to ${maskPhone(input.phone)}`,
      );
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.SMS_PROVIDER_ERROR,
        message: 'Unable to send the WhatsApp code right now.',
      });
    }

    // Like the SMS gateway, a refusal (bad key, no balance) still arrives as
    // HTTP 200 with {"status":"FAILED","message":"…"}.
    const body = await response.text();
    if (!response.ok || !isAccepted(body)) {
      this.logger.warn(
        `Renflair WhatsApp refused the send to ${maskPhone(input.phone)} ` +
          `(HTTP ${response.status}): ${body.slice(0, 300)}`,
      );
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.SMS_PROVIDER_ERROR,
        message: 'Unable to send the WhatsApp code right now.',
      });
    }

    this.logger.log(
      `OTP sent to ${maskPhone(input.phone)} via ${this.name}: ${body.trim().slice(0, 200)}`,
    );
    return { channel: 'whatsapp' };
  }
}
