import { BookingSlot } from '@prisma/client';
import { formatStayDate, type StaySlot } from '../mail/templates';

/*
  Day party, night party and overnight stay.

  Which of these a listing offers, and between what hours, is kept in the
  host-meta block at the top of `propertyRules` — the same block the listing
  wizard writes (apps/web/src/lib/host/listing-meta.ts). This reads just the
  slot lines from it, with the same defaults, so the server decides what can be
  booked from exactly what the guest was shown.

  A day or night party takes a single date. It is stored as one night
  (check-out the day after) so it shares the per-date lock with overnight
  stays: a date is sold once, whatever it is sold for.
*/

const MARKER = '---host-meta-v1---';

export type ListingSlots = {
  day: { offered: boolean; start: string; end: string };
  night: { offered: boolean; start: string; end: string };
  overnight: { offered: boolean; checkIn: string; checkOut: string };
};

const DEFAULTS: ListingSlots = {
  day: { offered: false, start: '09:00', end: '18:00' },
  night: { offered: false, start: '19:00', end: '06:00' },
  overnight: { offered: true, checkIn: '14:00', checkOut: '11:00' },
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function flag(value: string, fallback: boolean): boolean {
  const text = value.trim().toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return fallback;
}

function time(value: string, fallback: string): string {
  return TIME.test(value) ? value : fallback;
}

export function readListingSlots(propertyRules?: string | null): ListingSlots {
  const slots: ListingSlots = {
    day: { ...DEFAULTS.day },
    night: { ...DEFAULTS.night },
    overnight: { ...DEFAULTS.overnight },
  };
  if (!propertyRules?.startsWith(MARKER)) return slots;
  const block = propertyRules.split(MARKER)[1] ?? '';
  for (const line of block.split('\n')) {
    // The value of a time key is itself "HH:MM": split on the first colon.
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === 'daySlot')
      slots.day.offered = flag(value, DEFAULTS.day.offered);
    if (key === 'dayStart') slots.day.start = time(value, DEFAULTS.day.start);
    if (key === 'dayEnd') slots.day.end = time(value, DEFAULTS.day.end);
    if (key === 'nightSlot')
      slots.night.offered = flag(value, DEFAULTS.night.offered);
    if (key === 'nightStart')
      slots.night.start = time(value, DEFAULTS.night.start);
    if (key === 'nightEnd') slots.night.end = time(value, DEFAULTS.night.end);
    if (key === 'overnight')
      slots.overnight.offered = flag(value, DEFAULTS.overnight.offered);
    if (key === 'checkIn')
      slots.overnight.checkIn = time(value, DEFAULTS.overnight.checkIn);
    if (key === 'checkOut')
      slots.overnight.checkOut = time(value, DEFAULTS.overnight.checkOut);
  }
  return slots;
}

/**
 * Guests book day and night parties only; overnight stays are no longer
 * sold. A listing whose host turned neither party on — every listing saved
 * before parties existed — is offered as a night party, so it stays bookable.
 */
export function isSlotOffered(slots: ListingSlots, slot: BookingSlot): boolean {
  if (slot === BookingSlot.DAY) return slots.day.offered;
  if (slot === BookingSlot.NIGHT)
    return slots.night.offered || !slots.day.offered;
  return false;
}

/** The hours saved on a booking, or nulls for an overnight stay. */
export function slotHours(
  slots: ListingSlots,
  slot: BookingSlot,
): { slotStartTime: string | null; slotEndTime: string | null } {
  if (slot === BookingSlot.DAY) {
    return { slotStartTime: slots.day.start, slotEndTime: slots.day.end };
  }
  if (slot === BookingSlot.NIGHT) {
    return { slotStartTime: slots.night.start, slotEndTime: slots.night.end };
  }
  return { slotStartTime: null, slotEndTime: null };
}

export const SLOT_LABEL: Record<BookingSlot, string> = {
  OVERNIGHT: 'Overnight stay',
  DAY: 'Day party',
  NIGHT: 'Night party',
};

/** "19:00" → "7:00 pm". */
export function formatClock(value: string): string {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export type SlotSummary = StaySlot;

/**
 * How a party booking reads in emails and WhatsApp: when it starts and ends,
 * both with a time. Null for an overnight stay, which keeps its plain
 * check-in / check-out dates.
 *
 * A night party that ends after midnight ends on the check-out date; one that
 * ends before midnight (and every day party) ends on the date itself.
 */
export function describeSlot(booking: {
  slot?: BookingSlot | null;
  slotStartTime?: string | null;
  slotEndTime?: string | null;
  checkInDate: Date | string;
  checkOutDate: Date | string;
}): SlotSummary | null {
  const slot = booking.slot ?? BookingSlot.OVERNIGHT;
  if (slot === BookingSlot.OVERNIGHT) return null;
  const defaults = slot === BookingSlot.DAY ? DEFAULTS.day : DEFAULTS.night;
  const start = booking.slotStartTime || defaults.start;
  const end = booking.slotEndTime || defaults.end;
  const endsNextDay = end <= start;
  return {
    label: SLOT_LABEL[slot],
    from: `${formatStayDate(booking.checkInDate)}, ${formatClock(start)}`,
    to: `${formatStayDate(endsNextDay ? booking.checkOutDate : booking.checkInDate)}, ${formatClock(end)}`,
  };
}
