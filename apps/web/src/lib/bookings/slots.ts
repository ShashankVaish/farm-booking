import { addDaysIso, isPastDate, isUnavailableStatus, todayIso } from '@/lib/bookings/date-picker';
import type { BookingSlotKey } from '@/lib/bookings/types';
import { decodeListingMeta, listingSlots } from '@/lib/host/listing-meta';
import type { ApiProperty } from '@/lib/properties/types';
import { formatSlotRange, formatTime12 } from '@/lib/time/clock';

/*
  Day party, night party and overnight stay, as a guest books them.

  Which a listing offers comes from the same host-meta block the listing page
  reads, so the booking card offers exactly the options the page advertises.
  A party is one date: it is sent to the server as check-in that date and
  check-out the next, the same shape as a one-night stay.
*/

export const SLOT_LABEL: Record<BookingSlotKey, string> = {
  OVERNIGHT: 'Overnight stay',
  DAY: 'Day party',
  NIGHT: 'Night party',
};

const KEY_BY_META = { day: 'DAY', night: 'NIGHT', overnight: 'OVERNIGHT' } as const;

export type SlotChoice = {
  key: BookingSlotKey;
  label: string;
  /** "10:30 am – 6:00 pm · 7 hrs 30 min", or the check-in/out times. */
  detail: string;
  /** The host's flat price for this sitting, or null to use the night rate. */
  price: number | null;
};

function positive(value: number | string | null | undefined): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function bookableSlots(property: Pick<ApiProperty, 'propertyRules' | 'dayPartyPrice' | 'nightPartyPrice'>): SlotChoice[] {
  const { meta } = decodeListingMeta(property.propertyRules);
  return listingSlots(meta, { range: formatSlotRange, time: formatTime12 }).map((slot) => {
    const key = KEY_BY_META[slot.key];
    return {
      key,
      label: slot.label,
      detail: slot.detail,
      price: key === 'DAY' ? positive(property.dayPartyPrice) : key === 'NIGHT' ? positive(property.nightPartyPrice) : null,
    };
  });
}

/** A party is a single date: clicking a free day books that day. */
export function applySingleDateClick(
  clicked: string,
  statusByDate: Map<string, string>,
  today = todayIso(),
): { checkIn: string; checkOut: string; error?: string } | { error: string } {
  if (isPastDate(clicked, today)) return { error: 'Past dates cannot be selected.' };
  if (isUnavailableStatus(statusByDate.get(clicked))) return { error: 'That date is booked or blocked.' };
  return { checkIn: clicked, checkOut: addDaysIso(clicked, 1) };
}

/** "Wed, 7 Oct" for a yyyy-mm-dd date. */
export function partyDateLabel(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * How a booked party reads on trips, checkout and host pages:
 * { label: 'Night party', when: 'Wed, 7 Oct · 7:00 pm – 6:00 am' }.
 * Null for an overnight stay, which keeps its check-in / check-out display.
 */
export function bookingSlotSummary(booking: {
  slot?: BookingSlotKey | null;
  slotStartTime?: string | null;
  slotEndTime?: string | null;
  checkInDate: string;
}): { label: string; when: string } | null {
  const slot = booking.slot ?? 'OVERNIGHT';
  if (slot === 'OVERNIGHT') return null;
  const hours =
    booking.slotStartTime && booking.slotEndTime
      ? ` · ${formatTime12(booking.slotStartTime)} – ${formatTime12(booking.slotEndTime)}`
      : '';
  return { label: SLOT_LABEL[slot], when: `${partyDateLabel(booking.checkInDate)}${hours}` };
}

/**
 * The one-line "when" for a booking in lists and summaries:
 * "2026-10-07 → 2026-10-08" for a stay, "Day party · Wed, 7 Oct · 10:30 am –
 * 6:00 pm" for a party.
 */
export function stayDatesLabel(booking: {
  slot?: BookingSlotKey | null;
  slotStartTime?: string | null;
  slotEndTime?: string | null;
  checkInDate: string;
  checkOutDate: string;
}): string {
  const party = bookingSlotSummary(booking);
  if (party) return `${party.label} · ${party.when}`;
  return `${booking.checkInDate.slice(0, 10)} → ${booking.checkOutDate.slice(0, 10)}`;
}
