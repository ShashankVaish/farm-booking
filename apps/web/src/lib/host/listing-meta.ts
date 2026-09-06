export type ListingMeta = {
  beds: number;
  minStay: number;
  checkIn: string;
  checkOut: string;
  smoking: string;
  pets: string;
  noise: string;
  seasonal: string;
  extras: string[];
};

const MARKER = '---host-meta-v1---';

export const DEFAULT_LISTING_META: ListingMeta = {
  beds: 1,
  minStay: 1,
  checkIn: '14:00',
  checkOut: '11:00',
  smoking: 'Not allowed',
  pets: 'Not allowed',
  noise: 'Keep noise considerate after 22:00',
  seasonal: '',
  extras: [],
};

export function encodeListingMeta(meta: ListingMeta, rules: string): string {
  const extras = meta.extras.filter(Boolean).join(',');
  return [
    MARKER,
    `beds:${meta.beds}`,
    `minStay:${meta.minStay}`,
    `checkIn:${meta.checkIn}`,
    `checkOut:${meta.checkOut}`,
    `smoking:${meta.smoking}`,
    `pets:${meta.pets}`,
    `noise:${meta.noise}`,
    `seasonal:${meta.seasonal}`,
    `extras:${extras}`,
    MARKER,
    rules.trim(),
  ].join('\n');
}

export function decodeListingMeta(source?: string | null): { meta: ListingMeta; rules: string } {
  if (!source) {
    return { meta: { ...DEFAULT_LISTING_META }, rules: '' };
  }
  if (!source.startsWith(MARKER)) {
    return { meta: { ...DEFAULT_LISTING_META }, rules: source };
  }
  const parts = source.split(MARKER);
  const block = parts[1] ?? '';
  const rules = parts.slice(2).join(MARKER).replace(/^\n/, '');
  const meta: ListingMeta = { ...DEFAULT_LISTING_META };
  for (const line of block.split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === 'beds') meta.beds = Number(value) || 1;
    if (key === 'minStay') meta.minStay = Number(value) || 1;
    if (key === 'checkIn') meta.checkIn = value || DEFAULT_LISTING_META.checkIn;
    if (key === 'checkOut') meta.checkOut = value || DEFAULT_LISTING_META.checkOut;
    if (key === 'smoking') meta.smoking = value;
    if (key === 'pets') meta.pets = value;
    if (key === 'noise') meta.noise = value;
    if (key === 'seasonal') meta.seasonal = value;
    if (key === 'extras') meta.extras = value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
  }
  return { meta, rules };
}
