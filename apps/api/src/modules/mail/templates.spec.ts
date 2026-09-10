import {
  bookingConfirmedEmail,
  escapeHtml,
  firstName,
  formatInr,
  formatStayDate,
  hostBookingConfirmedEmail,
  paymentPendingEmail,
  shortRef,
  signupOtpEmail,
  type BookingEmailData,
} from './templates';

function stay(overrides: Partial<BookingEmailData> = {}): BookingEmailData {
  return {
    guestName: 'Asha Rao',
    propertyTitle: 'Lake House',
    location: 'Lonavala, Maharashtra',
    checkIn: new Date('2026-10-02T00:00:00.000Z'),
    checkOut: new Date('2026-10-04T00:00:00.000Z'),
    guests: 6,
    total: 18500,
    bookingId: '7f3c9a12-55d1-4a0e-9b2e-0c1d2e3f4a5b',
    brandName: 'Baagly',
    bookingUrl: 'https://baagly.test/bookings/7f3c9a12',
    ...overrides,
  };
}

describe('escapeHtml', () => {
  it('neutralises markup so a property title cannot inject into the email', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('escapes ampersands first so entities are not double-broken', () => {
    expect(escapeHtml('Tea & Co <b>')).toBe('Tea &amp; Co &lt;b&gt;');
  });
});

describe('formatInr', () => {
  it('formats whole rupees in the Indian grouping', () => {
    // 18,500 not 18.500 — Indian grouping puts the first separator at 3 digits
    // and every 2 after, which is why Intl is used rather than toLocaleString
    // with a default locale.
    expect(formatInr(18500)).toContain('18,500');
    expect(formatInr(1250000)).toContain('12,50,000');
  });

  it('accepts the string form Prisma Decimal serialises to', () => {
    expect(formatInr('1050.00')).toBe(formatInr(1050));
  });

  it('does not print NaN for a value that failed to parse', () => {
    expect(formatInr('not-a-number')).toBe('₹0');
  });
});

describe('formatStayDate', () => {
  it('renders a readable Indian date', () => {
    const rendered = formatStayDate(new Date('2026-10-02T00:00:00.000Z'));
    expect(rendered).toContain('2026');
    expect(rendered).toContain('Oct');
  });

  it('degrades rather than printing "Invalid Date"', () => {
    expect(formatStayDate('nonsense')).toBe('—');
  });
});

describe('firstName', () => {
  it('greets by first name', () => {
    expect(firstName('Asha Rao')).toBe('Asha');
  });

  it('falls back for a blank name instead of greeting nobody', () => {
    expect(firstName('   ')).toBe('there');
    expect(firstName('')).toBe('there');
  });
});

describe('shortRef', () => {
  it('quotes only the tail of a booking id', () => {
    expect(shortRef('7f3c9a12-55d1-4a0e-9b2e-0c1d2e3f4a5b')).toBe('2E3F4A5B');
  });

  it('handles an empty id', () => {
    expect(shortRef('')).toBe('—');
  });
});

describe('signupOtpEmail', () => {
  const rendered = signupOtpEmail({
    code: '482913',
    ttlMinutes: 10,
    brandName: 'Baagly',
  });

  it('puts the code in the subject so it is readable from the inbox list', () => {
    expect(rendered.subject).toBe('482913 is your Baagly verification code');
  });

  it('includes the code in both bodies', () => {
    expect(rendered.html).toContain('482913');
    expect(rendered.text).toContain('482913');
  });

  it('states the expiry and pluralises it', () => {
    expect(rendered.text).toContain('expires in 10 minutes');
    expect(
      signupOtpEmail({ code: '111111', ttlMinutes: 1, brandName: 'Baagly' })
        .text,
    ).toContain('expires in 1 minute');
  });

  it('tells a recipient who did not sign up that they can ignore it', () => {
    expect(rendered.text.toLowerCase()).toContain('did not try to sign up');
  });
});

describe('bookingConfirmedEmail', () => {
  const rendered = bookingConfirmedEmail(stay());

  it('names the property and the arrival date in the subject', () => {
    expect(rendered.subject).toContain('Lake House');
    expect(rendered.subject.startsWith('Confirmed —')).toBe(true);
  });

  it('carries every detail a guest needs in the text part', () => {
    expect(rendered.text).toContain('Lake House');
    expect(rendered.text).toContain('Lonavala, Maharashtra');
    expect(rendered.text).toContain('18,500');
    expect(rendered.text).toContain('6');
  });

  it('links to the booking', () => {
    expect(rendered.html).toContain('https://baagly.test/bookings/7f3c9a12');
    expect(rendered.text).toContain('https://baagly.test/bookings/7f3c9a12');
  });

  it('greets the guest by first name', () => {
    expect(rendered.text).toContain('Hi Asha,');
  });

  it('escapes a property title containing markup', () => {
    const hostile = bookingConfirmedEmail(
      stay({ propertyTitle: '<img src=x onerror=1>' }),
    );
    expect(hostile.html).not.toContain('<img src=x');
    expect(hostile.html).toContain('&lt;img src=x');
  });

  it('always ships a non-empty text alternative', () => {
    // A message with no text part reads as spam to most filters.
    expect(rendered.text.trim().length).toBeGreaterThan(0);
  });
});

describe('hostBookingConfirmedEmail', () => {
  const rendered = hostBookingConfirmedEmail({
    ...stay(),
    hostName: 'Vikram Shah',
  });

  it('greets the host, not the guest', () => {
    expect(rendered.text).toContain('Hi Vikram,');
  });

  it('names the guest so the host knows who is arriving', () => {
    expect(rendered.text).toContain('Asha Rao');
  });

  it('does not tell the host what the guest paid', () => {
    // The host's payout is net of platform fee and refunds, so showing the
    // gross total here would set the wrong expectation.
    expect(rendered.text).not.toContain('18,500');
    expect(rendered.html).not.toContain('18,500');
  });

  it('explains when the payout lands', () => {
    expect(rendered.text).toContain('after the guest checks out');
  });
});

describe('paymentPendingEmail', () => {
  const rendered = paymentPendingEmail({ ...stay(), holdMinutes: 30 });

  it('is clearly not a confirmation', () => {
    expect(rendered.subject).toContain('Payment pending');
    expect(rendered.text).toContain('not');
    expect(rendered.text).toContain('confirmed until payment is complete');
  });

  it('shows the amount due and the hold window', () => {
    expect(rendered.text).toContain('18,500');
    expect(rendered.text).toContain('30 minutes');
  });

  it('links back to checkout', () => {
    expect(rendered.html).toContain('https://baagly.test/bookings/7f3c9a12');
  });
});

describe('booking confirmation address block', () => {
  const located = {
    ...stay(),
    address: 'Plot 14, Sector 3, Greater Noida, Uttar Pradesh, 201310',
    mapUrl:
      'https://www.openstreetmap.org/?mlat=28.6259346&mlon=77.4369007#map=16/28.6259346/77.4369007',
    directionsUrl:
      'https://www.openstreetmap.org/directions?to=28.6259346%2C77.4369007',
  };

  it('gives the guest the full address once the stay is paid for', () => {
    const rendered = bookingConfirmedEmail(located);
    expect(rendered.text).toContain(
      'Plot 14, Sector 3, Greater Noida, Uttar Pradesh, 201310',
    );
    expect(rendered.html).toContain('Plot 14, Sector 3');
  });

  it('links to Google Maps and to directions in both bodies', () => {
    const rendered = bookingConfirmedEmail(located);
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain('openstreetmap.org/?mlat=');
      expect(body).toContain('openstreetmap.org/directions');
    }
    expect(rendered.html).toContain('View on the map');
    expect(rendered.html).toContain('Get directions');
  });

  it('omits the block entirely when the listing has no location', () => {
    // No empty "Address" heading over nothing.
    const rendered = bookingConfirmedEmail(stay());
    expect(rendered.html).not.toContain('Address');
    expect(rendered.text).not.toContain('Address:');
  });

  it('still renders a map link when the street address is unknown', () => {
    const rendered = bookingConfirmedEmail({
      ...stay(),
      mapUrl: located.mapUrl,
    });
    expect(rendered.html).toContain('View on the map');
  });

  it('escapes an address containing markup', () => {
    const rendered = bookingConfirmedEmail({
      ...located,
      address: '<b>Plot 14</b>',
    });
    expect(rendered.html).not.toContain('<b>Plot 14</b>');
    expect(rendered.html).toContain('&lt;b&gt;Plot 14');
  });

  it('keeps the exact address out of the awaiting-payment email', () => {
    // The terms promise the address stays private until a booking is confirmed.
    // This email is sent while it is not.
    const pending = paymentPendingEmail({ ...located, holdMinutes: 30 });
    expect(pending.text).not.toContain('Plot 14');
    expect(pending.html).not.toContain('Plot 14');
    expect(pending.html).not.toContain('openstreetmap.org');
  });

  it('keeps it out of the host copy too', () => {
    // The host knows their own address; repeating it is noise.
    const host = hostBookingConfirmedEmail({
      ...located,
      hostName: 'Vikram Shah',
    });
    expect(host.html).not.toContain('Plot 14');
  });
});
