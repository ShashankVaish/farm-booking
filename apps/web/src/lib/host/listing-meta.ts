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
  /*
    Which sittings the venue is let out for.

    Farmhouses and party venues in India are commonly booked as a day slot or a
    night slot rather than as an overnight stay, and a host needs to say which
    they run and between what hours. `overnight` is the classic stay governed by
    checkIn/checkOut above; it stays on by default so every listing that existed
    before these fields keeps behaving exactly as it did.
  */
  daySlot: boolean;
  dayStart: string;
  dayEnd: string;
  nightSlot: boolean;
  nightStart: string;
  nightEnd: string;
  overnight: boolean;
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
  daySlot: false,
  dayStart: '09:00',
  dayEnd: '18:00',
  nightSlot: false,
  nightStart: '19:00',
  nightEnd: '06:00',
  overnight: true,
};

/** Written as "true"/"false" so the block stays readable by eye. */
function encodeFlag(value: boolean): string {
  return value ? 'true' : 'false';
}

/**
 * Anything that is not literally "false" reads as true.
 *
 * This matters for `overnight`: a listing saved before the slot fields existed
 * has no `overnight` line at all, and must keep its overnight stay rather than
 * silently becoming a venue that cannot be booked for anything.
 */
function decodeFlag(value: string, fallback: boolean): boolean {
  const text = value.trim().toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return fallback;
}

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
    `daySlot:${encodeFlag(meta.daySlot)}`,
    `dayStart:${meta.dayStart}`,
    `dayEnd:${meta.dayEnd}`,
    `nightSlot:${encodeFlag(meta.nightSlot)}`,
    `nightStart:${meta.nightStart}`,
    `nightEnd:${meta.nightEnd}`,
    `overnight:${encodeFlag(meta.overnight)}`,
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
    // Split on the first colon only: the value of a time key is itself "HH:MM".
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
    if (key === 'daySlot') meta.daySlot = decodeFlag(value, DEFAULT_LISTING_META.daySlot);
    if (key === 'dayStart') meta.dayStart = value || DEFAULT_LISTING_META.dayStart;
    if (key === 'dayEnd') meta.dayEnd = value || DEFAULT_LISTING_META.dayEnd;
    if (key === 'nightSlot') meta.nightSlot = decodeFlag(value, DEFAULT_LISTING_META.nightSlot);
    if (key === 'nightStart') meta.nightStart = value || DEFAULT_LISTING_META.nightStart;
    if (key === 'nightEnd') meta.nightEnd = value || DEFAULT_LISTING_META.nightEnd;
    if (key === 'overnight') meta.overnight = decodeFlag(value, DEFAULT_LISTING_META.overnight);
  }
  return { meta, rules };
}

export type BookingSlot = { key: 'day' | 'night' | 'overnight'; label: string; detail: string };

/**
 * The sittings a listing is actually offered for, in the order a guest reads
 * them. Empty only if a host has turned every option off, which the wizard
 * prevents.
 */
export function listingSlots(
  meta: ListingMeta,
  format: {
    range: (start: string, end: string) => string;
    time: (value: string) => string;
  },
): BookingSlot[] {
  const slots: BookingSlot[] = [];
  if (meta.daySlot) {
    slots.push({
      key: 'day',
      label: 'Day party',
      detail: format.range(meta.dayStart, meta.dayEnd),
    });
  }
  if (meta.nightSlot) {
    slots.push({
      key: 'night',
      label: 'Night party',
      detail: format.range(meta.nightStart, meta.nightEnd),
    });
  }
  if (meta.overnight) {
    slots.push({
      key: 'overnight',
      label: 'Overnight stay',
      detail: `Check in after ${format.time(meta.checkIn)}, out by ${format.time(meta.checkOut)}`,
    });
  }
  return slots;
}
