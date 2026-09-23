/**
 * The legal entity behind the platform, as it appears on a signed agreement.
 *
 * Mirrors `apps/web/src/lib/config/business.ts`, which renders the same facts
 * in the footer and on the About page. They are duplicated because the repo
 * has no shared package; if the GST registration changes, change both.
 *
 * Read from the environment where set, so a deployment can correct a detail
 * without a code change, with the registered values as defaults.
 */
export type PlatformIdentity = {
  entity: string;
  gstin: string;
  address: string;
  brandName: string;
};

const DEFAULTS: PlatformIdentity = {
  entity: 'Shubh Gupta, sole proprietor trading as Shubh Traders',
  gstin: '09EANPG5213E1ZT',
  address:
    'Gate No. 2, Balaji Mandir Road, Near Balaji Mandir, Hallu Sarai, Sambhal, Uttar Pradesh 244302, India',
  brandName: 'Baagly',
};

export function platformIdentity(
  get: (key: string) => string | undefined,
): PlatformIdentity {
  const pick = (key: string, fallback: string) => get(key)?.trim() || fallback;
  return {
    entity: pick('BUSINESS_ENTITY', DEFAULTS.entity),
    gstin: pick('BUSINESS_GSTIN', DEFAULTS.gstin),
    address: pick('BUSINESS_ADDRESS', DEFAULTS.address),
    brandName: pick('MAIL_FROM_NAME', DEFAULTS.brandName),
  };
}
