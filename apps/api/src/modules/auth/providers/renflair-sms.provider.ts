import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { maskPhone } from './console-sms.provider';
import type { SendSmsInput, SmsProvider } from './sms-provider.interface';

const ENDPOINT = 'https://sms.renflair.in/V1.php';
const TIMEOUT_MS = 12_000;

/**
 * Renflair OTP gateway (non-DLT, India only).
 *
 * The API takes the code as a parameter and renders the message from its own
 * approved template, so `message` is ignored and `code` is required.
 *
 *   GET https://sms.renflair.in/V1.php?API=<key>&PHONE=<10 digits>&OTP=<code>
 *
 * PHONE must be a bare 10-digit Indian number — no +91, no leading zero.
 */
@Injectable()
export class RenflairSmsProvider implements SmsProvider {
  readonly name = 'renflair';
  private readonly logger = new Logger(RenflairSmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendSmsInput): Promise<void> {
    const apiKey = this.config.get<string>('RENFLAIR_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.SMS_PROVIDER_ERROR,
        message: 'SMS provider is not configured.',
      });
    }

    if (!input.code) {
      // Renflair cannot send arbitrary text, so a caller that only supplied a
      // message has made a mistake worth surfacing rather than half-sending.
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.SMS_PROVIDER_ERROR,
        message: 'This SMS provider can only deliver verification codes.',
      });
    }

    const phone = normalizeIndianMobile(input.phone);
    if (!phone) {
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.SMS_PROVIDER_ERROR,
        message: 'Renflair delivers to Indian mobile numbers only.',
      });
    }

    const url = new URL(ENDPOINT);
    url.searchParams.set('API', apiKey);
    url.searchParams.set('PHONE', phone);
    url.searchParams.set('OTP', input.code);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      this.logger.error(`Renflair timed out sending to ${maskPhone(input.phone)}`);
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.SMS_PROVIDER_ERROR,
        message: 'Unable to send SMS right now.',
      });
    }

    // The body is the only place a rejection is explained — an expired key or
    // an exhausted credit balance still comes back as HTTP 200.
    const body = await response.text();
    if (!response.ok || !isAccepted(body)) {
      this.logger.error(
        `Renflair rejected the send to ${maskPhone(input.phone)} ` +
          `(HTTP ${response.status}): ${body.slice(0, 300)}`,
      );
      throw new ServiceUnavailableException({
        errorCode: ErrorCodes.SMS_PROVIDER_ERROR,
        message: 'Unable to send SMS right now.',
      });
    }

    this.logger.log(`OTP sent to ${maskPhone(input.phone)} via ${this.name}`);
  }
}

/**
 * Renflair wants ten bare digits. Accepts the shapes a user or the database
 * might hold — +919876543210, 919876543210, 09876543210 — and rejects anything
 * that is not an Indian mobile.
 */
export function normalizeIndianMobile(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('91') && digits.length === 12
    ? digits.slice(2)
    : digits.startsWith('0') && digits.length === 11
      ? digits.slice(1)
      : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

/**
 * Treats the response as accepted unless it says otherwise.
 *
 * Renflair's published example reads `status` and `message` from the JSON but
 * does not document the values, so the check is deliberately loose: an
 * explicit failure marker rejects, anything else passes and is logged. Tighten
 * this once the live responses are known.
 */
export function isAccepted(body: string): boolean {
  const text = body.trim();
  if (!text) return false;

  try {
    const parsed = JSON.parse(text) as { status?: unknown; message?: unknown };
    const status = String(parsed.status ?? '').toLowerCase();
    if (['success', 'true', '1', 'ok', 'sent'].includes(status)) return true;
    if (['error', 'false', '0', 'failed', 'failure'].includes(status)) return false;
    // Unknown status value: fall through to the text check below.
  } catch {
    // Not JSON — some gateways answer with a bare string.
  }

  return !/\b(error|invalid|failed|failure|insufficient|expired|unauthorized)\b/i.test(
    text,
  );
}
