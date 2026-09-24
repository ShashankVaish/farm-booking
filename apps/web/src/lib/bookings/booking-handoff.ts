import type { CustomerBooking } from './types';

/*
  Hands a booking the client already has to the page it is navigating to.

  Reserve creates the booking and gets it back in full; the checkout page used
  to fetch it again the moment it opened, showing a spinner for that extra
  round trip. The page now draws this copy at once and refreshes it from the
  server in the background.

  Module memory, not storage: it lives exactly as long as the client-side
  navigation it exists for, and nothing about a booking is written to disk.
*/

const MAX_AGE_MS = 60_000;
const handed = new Map<string, { booking: CustomerBooking; at: number }>();

export function handOffBooking(booking: CustomerBooking): void {
  // A thin payload would render a checkout with no property on it.
  if (!booking?.id || !booking.property?.title) return;
  handed.set(booking.id, { booking, at: Date.now() });
}

/**
 * Reads without removing: React calls state initialisers twice in development,
 * and a read that deleted would hand the second call nothing. Entries expire
 * after a minute instead, by which time the page has its own fresh copy.
 */
export function peekHandedOffBooking(id: string): CustomerBooking | null {
  const entry = handed.get(id);
  if (!entry) return null;
  if (Date.now() - entry.at > MAX_AGE_MS) {
    handed.delete(id);
    return null;
  }
  return entry.booking;
}
