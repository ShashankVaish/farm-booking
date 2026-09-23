/**
 * The legal identity behind the Baagly brand.
 *
 * Kept separate from `brand`, which is marketing: this is the registered
 * business that takes the money, and it appears verbatim in the footer, on the
 * About and Contact pages, in the host agreement, and in the details a payment
 * gateway checks during merchant onboarding. India's Consumer Protection
 * (E-Commerce) Rules, 2020 require an e-commerce entity to display its legal
 * name, principal geographic address and contact details, so these are public
 * on purpose.
 *
 * Every value below is taken from the GST registration certificate
 * (Form GST REG-06). If the registration changes, change it here — nothing
 * else hard-codes it.
 */

/**
 * PAN is embedded in the GSTIN: characters 3–12. Derived rather than repeated
 * so the two can never drift apart.
 */
const GSTIN = '09EANPG5213E1ZT';

export const business = {
  /** The legal person. For a proprietorship that is the proprietor. */
  legalName: 'Shubh Gupta',
  /** The registered trade name the business operates under. */
  tradeName: 'Shubh Traders',
  /** How to refer to the entity in one line, e.g. in a contract or the footer. */
  entity: 'Shubh Gupta, sole proprietor trading as Shubh Traders',
  constitution: 'Proprietorship',
  proprietor: 'Shubh Gupta',

  gstin: GSTIN,
  pan: GSTIN.slice(2, 12),
  gstRegisteredOn: '18 September 2026',
  gstType: 'Regular',

  /** The principal place of business, as registered. */
  address: {
    line1: 'Gate No. 2, Balaji Mandir Road',
    line2: 'Near Balaji Mandir, Hallu Sarai',
    city: 'Sambhal',
    district: 'Sambhal',
    state: 'Uttar Pradesh',
    pincode: '244302',
    country: 'India',
  },
} as const;

/** One-line address for a footer or a contract. */
export function addressLine(): string {
  const a = business.address;
  return `${a.line1}, ${a.line2}, ${a.city}, ${a.state} ${a.pincode}, ${a.country}`;
}

/** Address as separate lines, for a Contact page or a postal block. */
export function addressLines(): string[] {
  const a = business.address;
  return [a.line1, a.line2, `${a.city}, ${a.district} District`, `${a.state} ${a.pincode}`, a.country];
}
