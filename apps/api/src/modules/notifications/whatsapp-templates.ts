import {
  firstName,
  formatInr,
  formatStayDate,
  shortRef,
} from '../mail/templates';
import type { WhatsAppTemplate } from './whatsapp.service';

/*
  Every WhatsApp template this site sends, with the exact text to submit in
  Meta's WhatsApp Manager. A template must be approved under exactly this name,
  in category UTILITY and language English ("en"), before anything is sent;
  until then Meta refuses the message and it is only logged.

  The body placeholders are numbered {{1}}, {{2}} … and the builders below fill
  them in that order. Changing the wording here does nothing by itself — the
  approved text in Meta is what the customer sees — so a wording change means
  editing the template in WhatsApp Manager and waiting for re-approval.
*/

export type WhatsAppTemplateDefinition = {
  name: string;
  /** Who receives it. */
  audience: 'guest' | 'host';
  /** The body to paste into WhatsApp Manager. */
  body: string;
  /** Sample values Meta asks for when the template is submitted. */
  examples: string[];
  /** The "Visit website" button, if the template has one. */
  button?: { text: string; url: string; example?: string };
};

export const WHATSAPP_TEMPLATES = {
  bookingConfirmed: {
    name: 'booking_confirmed',
    audience: 'guest',
    body: 'Hi {{1}}, your stay at {{2}} is confirmed. Check-in: {{3}}. Check-out: {{4}}. Guests: {{5}}. Booking ref: {{6}}. The exact address and directions are on your booking page.',
    examples: [
      'Asha',
      'Lake House Farm',
      'Sat, 3 Oct, 2026',
      'Sun, 4 Oct, 2026',
      '6',
      '3E4F5A6B',
    ],
    button: {
      text: 'View booking',
      url: 'https://www.baagly.com/booking/{{1}}',
      example:
        'https://www.baagly.com/booking/3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b',
    },
  },
  hostBookingConfirmed: {
    name: 'host_booking_confirmed',
    audience: 'host',
    body: 'Hi {{1}}, you have a new confirmed booking at {{2}}. Guest: {{3}}. Check-in: {{4}}. Check-out: {{5}}. Guests: {{6}}. The dates are now blocked on your calendar.',
    examples: [
      'Ravi',
      'Lake House Farm',
      'Asha Rao',
      'Sat, 3 Oct, 2026',
      'Sun, 4 Oct, 2026',
      '6',
    ],
    button: {
      text: 'Open calendar',
      url: 'https://www.baagly.com/host/calendar',
    },
  },
  paymentFailed: {
    name: 'payment_failed',
    audience: 'guest',
    body: 'Hi {{1}}, your payment for {{2}} did not go through. Your dates are still held for a short while, and you can try again from your booking.',
    examples: ['Asha', 'Lake House Farm'],
    button: {
      text: 'Try again',
      url: 'https://www.baagly.com/booking/{{1}}',
      example:
        'https://www.baagly.com/booking/3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b',
    },
  },
  bookingCancelled: {
    name: 'booking_cancelled',
    audience: 'guest',
    body: 'Hi {{1}}, your booking at {{2}} for {{3}} to {{4}} has been cancelled. If a refund is due, it will be sent to the payment method you used.',
    examples: [
      'Asha',
      'Lake House Farm',
      'Sat, 3 Oct, 2026',
      'Sun, 4 Oct, 2026',
    ],
    button: {
      text: 'View booking',
      url: 'https://www.baagly.com/booking/{{1}}',
      example:
        'https://www.baagly.com/booking/3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b',
    },
  },
  refundProcessed: {
    name: 'refund_processed',
    audience: 'guest',
    body: 'Hi {{1}}, a refund of {{2}} for your booking at {{3}} has been processed. It usually reaches your account within 5 to 10 working days, depending on your bank.',
    examples: ['Asha', '₹12,500', 'Lake House Farm'],
  },
} as const satisfies Record<string, WhatsAppTemplateDefinition>;

type Stay = {
  propertyTitle: string;
  checkIn: Date | string;
  checkOut: Date | string;
  guests: number;
  bookingId: string;
};

export function bookingConfirmedWhatsApp(
  data: Stay & { guestName: string },
): WhatsAppTemplate {
  return {
    name: WHATSAPP_TEMPLATES.bookingConfirmed.name,
    bodyParams: [
      firstName(data.guestName),
      data.propertyTitle,
      formatStayDate(data.checkIn),
      formatStayDate(data.checkOut),
      String(data.guests),
      shortRef(data.bookingId),
    ],
    urlButtonParam: data.bookingId,
  };
}

export function hostBookingConfirmedWhatsApp(
  data: Stay & { hostName: string; guestName: string },
): WhatsAppTemplate {
  return {
    name: WHATSAPP_TEMPLATES.hostBookingConfirmed.name,
    bodyParams: [
      firstName(data.hostName),
      data.propertyTitle,
      data.guestName,
      formatStayDate(data.checkIn),
      formatStayDate(data.checkOut),
      String(data.guests),
    ],
  };
}

export function paymentFailedWhatsApp(data: {
  guestName: string;
  propertyTitle: string;
  bookingId: string;
}): WhatsAppTemplate {
  return {
    name: WHATSAPP_TEMPLATES.paymentFailed.name,
    bodyParams: [firstName(data.guestName), data.propertyTitle],
    urlButtonParam: data.bookingId,
  };
}

export function bookingCancelledWhatsApp(
  data: Omit<Stay, 'guests'> & { guestName: string },
): WhatsAppTemplate {
  return {
    name: WHATSAPP_TEMPLATES.bookingCancelled.name,
    bodyParams: [
      firstName(data.guestName),
      data.propertyTitle,
      formatStayDate(data.checkIn),
      formatStayDate(data.checkOut),
    ],
    urlButtonParam: data.bookingId,
  };
}

export function refundProcessedWhatsApp(data: {
  guestName: string;
  amount: number | string;
  propertyTitle: string;
}): WhatsAppTemplate {
  return {
    name: WHATSAPP_TEMPLATES.refundProcessed.name,
    bodyParams: [
      firstName(data.guestName),
      formatInr(data.amount),
      data.propertyTitle,
    ],
  };
}
