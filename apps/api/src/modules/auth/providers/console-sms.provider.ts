import { Injectable, Logger } from '@nestjs/common';
import type { SendSmsInput, SmsProvider } from './sms-provider.interface';

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  send(input: SendSmsInput): Promise<void> {
    const masked = maskPhone(input.phone);
    this.logger.log(`SMS queued for ${masked} via ${this.name}`);
    return Promise.resolve();
  }
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) {
    return '****';
  }
  return `******${digits.slice(-4)}`;
}
