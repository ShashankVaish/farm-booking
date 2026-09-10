/**
 * Email templates.
 *
 * These are deliberately plain functions returning a rendered subject, HTML and
 * text: nothing here touches SMTP, so the wording and escaping can be tested
 * without a mail server.
 *
 * The HTML is table-based with inline styles because that is what mail clients
 * actually support — Outlook still ignores most of `<style>`, and flexbox and
 * CSS variables are unusable. The site's own tokens are therefore hard-coded
 * here as literals rather than referenced.
 */

const BRAND = {
  coral: '#ff5a60',
  ink: '#0d0c10',
  cream: '#f1e5dd',
  body: '#3a3540',
  muted: '#6e6873',
  hairline: '#e2d5cc',
  card: '#ffffff',
};

export type RenderedEmail = { subject: string; html: string; text: string };

/** User-supplied text (property titles, names) is interpolated into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatInr(amount: number | string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatStayDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

type DetailRow = { label: string; value: string };

function detailRows(rows: DetailRow[]): string {
  return rows
    .map(
      ({ label, value }) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid ${BRAND.hairline};color:${BRAND.muted};font-size:13px;">${escapeHtml(label)}</td>
                <td style="padding:10px 0;border-bottom:1px solid ${BRAND.hairline};color:${BRAND.ink};font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
              </tr>`,
    )
    .join('');
}

function button(label: string, url: string): string {
  return `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
            <tr>
              <td style="border-radius:8px;background:${BRAND.coral};">
                <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 26px;color:#2a0c0f;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
              </td>
            </tr>
          </table>`;
}

function layout(options: {
  preheader: string;
  heading: string;
  body: string;
  brandName: string;
}): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:${BRAND.cream};">
  <!-- Shown as the preview line in the inbox, then hidden in the message. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:22px 32px;background:${BRAND.ink};">
              <span style="color:${BRAND.cream};font-size:19px;font-weight:700;letter-spacing:0.14em;">${escapeHtml(options.brandName.toUpperCase())}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <h1 style="margin:0 0 16px;color:${BRAND.ink};font-size:22px;line-height:1.3;font-weight:700;">${escapeHtml(options.heading)}</h1>
              ${options.body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.hairline};color:${BRAND.muted};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;">
              You are receiving this because you have an account with ${escapeHtml(options.brandName)}.<br />
              Please do not reply to this message — this mailbox is not monitored.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;color:${BRAND.body};font-size:15px;line-height:1.65;">${text}</p>`;
}

// --- Signup OTP ------------------------------------------------------------

export function signupOtpEmail(input: {
  code: string;
  ttlMinutes: number;
  brandName: string;
}): RenderedEmail {
  const body = `
          ${paragraph('Use this code to confirm your email address and finish creating your account.')}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
            <tr>
              <td style="padding:18px 30px;background:${BRAND.cream};border-radius:12px;color:${BRAND.ink};font-size:32px;font-weight:700;letter-spacing:0.32em;font-family:'SFMono-Regular',Consolas,monospace;">${escapeHtml(input.code)}</td>
            </tr>
          </table>
          ${paragraph(`The code expires in ${input.ttlMinutes} minute${input.ttlMinutes === 1 ? '' : 's'}.`)}
          ${paragraph(`<strong style="color:${BRAND.ink};">If you did not try to sign up, ignore this email.</strong> Nobody can use this code without access to your inbox, and no account is created until it is entered.`)}`;

  return {
    subject: `${input.code} is your ${input.brandName} verification code`,
    html: layout({
      preheader: `Your verification code is ${input.code}.`,
      heading: 'Confirm your email',
      body,
      brandName: input.brandName,
    }),
    text: [
      'Confirm your email',
      '',
      `Your ${input.brandName} verification code is ${input.code}.`,
      `It expires in ${input.ttlMinutes} minute${input.ttlMinutes === 1 ? '' : 's'}.`,
      '',
      'If you did not try to sign up, ignore this email. No account is created until the code is entered.',
    ].join('\n'),
  };
}

// --- Signup attempted on an address that already has an account ------------

/**
 * Sent instead of a code when the address is already registered.
 *
 * Signup must not answer "that address is taken" — that turns the form into a
 * membership oracle anyone can query. But saying nothing at all stranded real
 * people on a "check your inbox" screen waiting for a code that was never
 * going to arrive. Sending this instead keeps the API response identical for
 * both cases while telling the actual owner of the inbox what happened.
 */
export function existingAccountEmail(input: {
  brandName: string;
  loginUrl: string;
}): RenderedEmail {
  const body = `
          ${paragraph(`Someone just tried to create a ${escapeHtml(input.brandName)} account with this email address, but you already have one.`)}
          ${paragraph('If that was you, sign in instead — there is no need to sign up again.')}
          ${button('Sign in', input.loginUrl)}
          ${paragraph(`<span style="color:${BRAND.muted};font-size:13px;">If it was not you, you can ignore this email. No new account was created and nothing about your existing account has changed.</span>`)}`;

  return {
    subject: `You already have a ${input.brandName} account`,
    html: layout({
      preheader: 'You already have an account with this email address.',
      heading: 'You already have an account',
      body,
      brandName: input.brandName,
    }),
    text: [
      'You already have an account',
      '',
      `Someone just tried to create a ${input.brandName} account with this email`,
      'address, but you already have one.',
      '',
      `If that was you, sign in instead: ${input.loginUrl}`,
      '',
      'If it was not you, you can ignore this email. No new account was created',
      'and nothing about your existing account has changed.',
    ].join('\n'),
  };
}

// --- Booking confirmed -----------------------------------------------------

export type BookingEmailData = {
  guestName: string;
  propertyTitle: string;
  location: string;
  checkIn: Date | string;
  checkOut: Date | string;
  guests: number;
  total: number | string;
  bookingId: string;
  brandName: string;
  bookingUrl: string;
  /*
    Full street address and a Google Maps link.

    Only populated for a confirmed booking. The listing page and the
    awaiting-payment email deliberately show the area alone — the terms promise
    that the exact address stays private until a booking is confirmed, and this
    email is the moment that promise is satisfied rather than broken.
  */
  address?: string | null;
  mapUrl?: string | null;
  directionsUrl?: string | null;
};

/**
 * The address block, shown only once a booking is confirmed.
 *
 * A guest reading this on the day wants two things: the address to give a
 * driver, and a link that opens navigation. Both are plain text and a plain
 * link — no map image, because Static Maps would need an API key inside the
 * email and most clients block remote images by default anyway.
 */
function addressBlock(data: BookingEmailData): string {
  const address = (data.address ?? '').trim();
  if (!address && !data.mapUrl) return '';

  const lines: string[] = [];
  if (address) {
    lines.push(
      `<p style="margin:0 0 6px;color:${BRAND.ink};font-size:15px;line-height:1.6;font-weight:600;">${escapeHtml(address)}</p>`,
    );
  }
  const links: string[] = [];
  if (data.mapUrl) {
    links.push(
      `<a href="${escapeHtml(data.mapUrl)}" style="color:${BRAND.coral};font-weight:600;text-decoration:underline;">View on Google Maps</a>`,
    );
  }
  if (data.directionsUrl) {
    links.push(
      `<a href="${escapeHtml(data.directionsUrl)}" style="color:${BRAND.coral};font-weight:600;text-decoration:underline;">Get directions</a>`,
    );
  }
  if (links.length > 0) {
    lines.push(
      `<p style="margin:0;font-size:14px;line-height:1.6;">${links.join(' &nbsp;·&nbsp; ')}</p>`,
    );
  }

  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">
            <tr>
              <td style="padding:16px 18px;background:${BRAND.cream};border-radius:12px;">
                <p style="margin:0 0 8px;color:${BRAND.muted};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Address</p>
                ${lines.join('\n                ')}
              </td>
            </tr>
          </table>`;
}

export function bookingConfirmedEmail(data: BookingEmailData): RenderedEmail {
  const rows = detailRows([
    { label: 'Property', value: data.propertyTitle },
    { label: 'Where', value: data.location },
    { label: 'Check-in', value: formatStayDate(data.checkIn) },
    { label: 'Check-out', value: formatStayDate(data.checkOut) },
    { label: 'Guests', value: String(data.guests) },
    { label: 'Total paid', value: formatInr(data.total) },
  ]);

  const body = `
          ${paragraph(`Hi ${escapeHtml(firstName(data.guestName))}, your payment went through and your stay is confirmed. The host has been told to expect you.`)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${rows}</table>
          ${addressBlock(data)}
          ${button('View your booking', data.bookingUrl)}
          ${paragraph(`<span style="color:${BRAND.muted};font-size:13px;">Booking reference ${escapeHtml(shortRef(data.bookingId))}</span>`)}`;

  const addressLines: string[] = [];
  if ((data.address ?? '').trim()) {
    addressLines.push('', 'Address:', `  ${(data.address ?? '').trim()}`);
  }
  if (data.mapUrl) addressLines.push(`  View on Google Maps: ${data.mapUrl}`);
  if (data.directionsUrl) addressLines.push(`  Get directions: ${data.directionsUrl}`);

  return {
    subject: `Confirmed — ${data.propertyTitle}, ${formatStayDate(data.checkIn)}`,
    html: layout({
      preheader: `Your stay at ${data.propertyTitle} is confirmed.`,
      heading: 'Your stay is confirmed',
      body,
      brandName: data.brandName,
    }),
    text: [
      'Your stay is confirmed',
      '',
      `Hi ${firstName(data.guestName)}, your payment went through and your stay is confirmed.`,
      '',
      `Property:   ${data.propertyTitle}`,
      `Where:      ${data.location}`,
      `Check-in:   ${formatStayDate(data.checkIn)}`,
      `Check-out:  ${formatStayDate(data.checkOut)}`,
      `Guests:     ${data.guests}`,
      `Total paid: ${formatInr(data.total)}`,
      ...addressLines,
      '',
      `View your booking: ${data.bookingUrl}`,
      `Booking reference ${shortRef(data.bookingId)}`,
    ].join('\n'),
  };
}

/** The host's copy of the same event — no payment total, an arrival heads-up. */
export function hostBookingConfirmedEmail(
  data: BookingEmailData & { hostName: string },
): RenderedEmail {
  const rows = detailRows([
    { label: 'Property', value: data.propertyTitle },
    { label: 'Guest', value: data.guestName },
    { label: 'Check-in', value: formatStayDate(data.checkIn) },
    { label: 'Check-out', value: formatStayDate(data.checkOut) },
    { label: 'Guests', value: String(data.guests) },
  ]);

  const body = `
          ${paragraph(`Hi ${escapeHtml(firstName(data.hostName))}, a guest has paid in full for ${escapeHtml(data.propertyTitle)}. These dates are now blocked on your calendar.`)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${rows}</table>
          ${button('Open your calendar', data.bookingUrl)}
          ${paragraph(`<span style="color:${BRAND.muted};font-size:13px;">Your payout is released after the guest checks out. Booking reference ${escapeHtml(shortRef(data.bookingId))}</span>`)}`;

  return {
    subject: `New confirmed booking — ${data.propertyTitle}, ${formatStayDate(data.checkIn)}`,
    html: layout({
      preheader: `${data.guestName} booked ${data.propertyTitle}.`,
      heading: 'You have a confirmed booking',
      body,
      brandName: data.brandName,
    }),
    text: [
      'You have a confirmed booking',
      '',
      `Hi ${firstName(data.hostName)}, a guest has paid in full for ${data.propertyTitle}.`,
      'These dates are now blocked on your calendar.',
      '',
      `Guest:     ${data.guestName}`,
      `Check-in:  ${formatStayDate(data.checkIn)}`,
      `Check-out: ${formatStayDate(data.checkOut)}`,
      `Guests:    ${data.guests}`,
      '',
      `Open your calendar: ${data.bookingUrl}`,
      `Your payout is released after the guest checks out. Booking reference ${shortRef(data.bookingId)}`,
    ].join('\n'),
  };
}

// --- Payment pending -------------------------------------------------------

export function paymentPendingEmail(
  data: BookingEmailData & { holdMinutes: number },
): RenderedEmail {
  const rows = detailRows([
    { label: 'Property', value: data.propertyTitle },
    { label: 'Check-in', value: formatStayDate(data.checkIn) },
    { label: 'Check-out', value: formatStayDate(data.checkOut) },
    { label: 'Guests', value: String(data.guests) },
    { label: 'Amount due', value: formatInr(data.total) },
  ]);

  const body = `
          ${paragraph(`Hi ${escapeHtml(firstName(data.guestName))}, we are holding these dates for you, but the booking is not confirmed until payment is complete.`)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${rows}</table>
          ${button('Complete payment', data.bookingUrl)}
          ${paragraph(`<span style="color:${BRAND.muted};font-size:13px;">The hold expires in about ${data.holdMinutes} minutes, after which the dates go back on sale. Booking reference ${escapeHtml(shortRef(data.bookingId))}</span>`)}`;

  return {
    subject: `Payment pending — ${data.propertyTitle}`,
    html: layout({
      preheader: `Complete payment to confirm ${data.propertyTitle}.`,
      heading: 'One step left',
      body,
      brandName: data.brandName,
    }),
    text: [
      'One step left',
      '',
      `Hi ${firstName(data.guestName)}, we are holding these dates for you, but the booking is not`,
      'confirmed until payment is complete.',
      '',
      `Property:   ${data.propertyTitle}`,
      `Check-in:   ${formatStayDate(data.checkIn)}`,
      `Check-out:  ${formatStayDate(data.checkOut)}`,
      `Guests:     ${data.guests}`,
      `Amount due: ${formatInr(data.total)}`,
      '',
      `Complete payment: ${data.bookingUrl}`,
      `The hold expires in about ${data.holdMinutes} minutes. Booking reference ${shortRef(data.bookingId)}`,
    ].join('\n'),
  };
}

// --- Helpers ---------------------------------------------------------------

/** Greetings read badly with a full legal name, and worse with an empty one. */
export function firstName(name: string): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first || 'there';
}

/** A booking id is a uuid; only the tail is useful to quote at support. */
export function shortRef(bookingId: string): string {
  return (bookingId ?? '').slice(-8).toUpperCase() || '—';
}
