import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PROVIDER_TIMEOUT_MS = 10_000;
const DEFAULT_API_VERSION = 'v21.0';

/*
  WhatsApp through Meta's Cloud API.

  A business may only START a conversation with a pre-approved *template*;
  free text is allowed only within 24 hours of the customer writing to us,
  which never happens for a booking update. So everything sent from here is a
  template: its name, its language, the values for its {{1}}, {{2}} … body
  placeholders and, optionally, the dynamic suffix of a URL button.

  The template text itself lives in Meta, not here. The names and the order of
  the parameters must match what was approved — see docs/whatsapp.md, which
  lists every template this code sends.

  Sending never throws. The booking, payment or refund that triggered it has
  already happened; a WhatsApp failure is logged, never turned into an error
  for the guest.
*/

export type WhatsAppTemplate = {
  /** The approved template name, e.g. `booking_confirmed`. */
  name: string;
  /** Values for {{1}}, {{2}} … in the template body, in order. */
  bodyParams: string[];
  /** Replaces {{1}} at the end of the template's URL button, if it has one. */
  urlButtonParam?: string;
};

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const { token, phoneNumberId } = this.settings();
    return Boolean(token && phoneNumberId);
  }

  /**
   * Sends one template message. Returns true when Meta accepted it for
   * delivery (which is not yet proof it was delivered — the customer's phone
   * may be offline, or the number may not be on WhatsApp).
   */
  async sendTemplate(
    phone: string,
    template: WhatsAppTemplate,
  ): Promise<boolean> {
    const { token, phoneNumberId, version, language } = this.settings();
    const to = whatsappNumber(phone);
    if (!token || !phoneNumberId || !to) {
      return false;
    }

    const components: unknown[] = [];
    if (template.bodyParams.length) {
      components.push({
        type: 'body',
        parameters: template.bodyParams.map((text) => ({
          type: 'text',
          text: templateText(text),
        })),
      });
    }
    if (template.urlButtonParam) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: template.urlButtonParam }],
      });
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'template',
            template: {
              name: template.name,
              language: { code: language },
              ...(components.length ? { components } : {}),
            },
          }),
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(
          `WhatsApp ${template.name} to ${maskNumber(to)} refused (HTTP ${response.status}): ${describeGraphError(body)}`,
        );
        return false;
      }
      return true;
    } catch (error: unknown) {
      this.logger.warn(
        `WhatsApp ${template.name} to ${maskNumber(to)} failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return false;
    }
  }

  private settings() {
    const read = (key: string) => this.config.get<string>(key)?.trim() ?? '';
    return {
      token: read('WHATSAPP_ACCESS_TOKEN'),
      phoneNumberId: read('WHATSAPP_PHONE_NUMBER_ID'),
      version: read('WHATSAPP_API_VERSION') || DEFAULT_API_VERSION,
      language: read('WHATSAPP_TEMPLATE_LANGUAGE') || 'en',
    };
  }
}

/**
 * Phones are stored as ten-digit Indian mobiles; WhatsApp wants the full
 * international number without the plus. Anything else is not sent.
 */
export function whatsappNumber(
  phone: string | null | undefined,
): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits;
  return null;
}

/**
 * Meta rejects a template parameter containing a newline, a tab, or more than
 * four spaces in a row, and caps its length. User-supplied text (a property
 * title) is flattened to fit rather than failing the whole message.
 */
export function templateText(value: string): string {
  const flat = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
  return (flat || '-').slice(0, 900);
}

function maskNumber(number: string): string {
  return `${number.slice(0, 4)}******${number.slice(-2)}`;
}

function describeGraphError(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: {
        code?: number;
        message?: string;
        error_data?: { details?: string };
      };
    };
    const error = parsed.error;
    if (error) {
      return [error.code, error.message, error.error_data?.details]
        .filter(Boolean)
        .join(': ');
    }
  } catch {
    // not JSON
  }
  return body.slice(0, 200);
}
