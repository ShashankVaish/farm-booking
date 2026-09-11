import { publicEnv } from '@/lib/config/env';

/**
 * Support contact details.
 *
 * `phone` is the number as a human reads it; `phoneHref` is the same number in
 * the E.164 form a dialler needs. They are kept as separate fields rather than
 * derived at each call site, because a `tel:` link built from the display
 * string by stripping spaces silently loses the country code and fails from
 * outside India.
 */
const support = {
  phone: '+91 99977 60912',
  phoneHref: 'tel:+919997760912',
  email: 'info@baagly.com',
  emailHref: 'mailto:info@baagly.com',
  hours: 'Every day, 9am – 9pm IST',
} as const;

export const brand = {
  name: publicEnv.brandName,
  tagline: 'Find the perfect private place for your next celebration.',
  shortDescription:
    'Private farmhouses, villas, and party venues for gatherings that deserve more than a hotel room.',
  support,
} as const;
