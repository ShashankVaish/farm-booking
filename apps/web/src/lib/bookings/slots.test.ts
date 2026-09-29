import { describe, expect, it } from 'vitest';
import { DEFAULT_LISTING_META, encodeListingMeta } from '@/lib/host/listing-meta';
import { openBookingKey } from '@/lib/bookings/types';
import { applySingleDateClick, bookableSlots, stayDatesLabel } from '@/lib/bookings/slots';

const venueRules = encodeListingMeta(
  {
    ...DEFAULT_LISTING_META,
    daySlot: true,
    dayStart: '10:30',
    dayEnd: '18:00',
    nightSlot: true,
    nightStart: '19:00',
    nightEnd: '06:00',
    overnight: true,
  },
  'No glass by the pool',
);

describe('booking slots', () => {
  it('offers day and night parties only, never an overnight stay', () => {
    const slots = bookableSlots({ propertyRules: venueRules, dayPartyPrice: '6000.00' });
    expect(slots.map((slot) => slot.key)).toEqual(['DAY', 'NIGHT']);
    expect(slots[0]).toMatchObject({ label: 'Day party', price: 6000 });
    expect(slots[0].detail).toContain('10:30 am – 6:00 pm');
    // A night party is always the listing's own price.
    expect(slots[1].price).toBeNull();
  });

  it('shows only the night party when that is all the host offers', () => {
    const nightOnly = encodeListingMeta({ ...DEFAULT_LISTING_META, daySlot: false, nightSlot: true }, '');
    expect(bookableSlots({ propertyRules: nightOnly }).map((slot) => slot.key)).toEqual(['NIGHT']);
  });

  it('prices a day party like a night party when the host set no day price', () => {
    const [day] = bookableSlots({ propertyRules: venueRules, dayPartyPrice: null });
    expect(day.price).toBeNull();
  });

  it('sells an older listing with no party turned on as a night party', () => {
    expect(bookableSlots({ propertyRules: 'Just rules' }).map((slot) => slot.key)).toEqual(['NIGHT']);
  });

  it('books a party for the tapped date only, and never a taken one', () => {
    const status = new Map([['2026-10-08', 'BOOKED']]);
    expect(applySingleDateClick('2026-10-07', status, '2026-09-29')).toEqual({
      checkIn: '2026-10-07',
      checkOut: '2026-10-08',
    });
    expect(applySingleDateClick('2026-10-08', status, '2026-09-29')).toEqual({
      error: 'That date is booked or blocked.',
    });
    expect(applySingleDateClick('2026-09-01', status, '2026-09-29')).toHaveProperty('error');
  });

  it('describes a booked party by its slot and hours', () => {
    const label = stayDatesLabel({
      slot: 'NIGHT',
      slotStartTime: '19:00',
      slotEndTime: '06:00',
      checkInDate: '2026-10-07T00:00:00.000Z',
      checkOutDate: '2026-10-08T00:00:00.000Z',
    });
    expect(label).toMatch(/^Night party · Wed, 7 Oct · 7:00 pm – 6:00 am$/);
    expect(stayDatesLabel({ checkInDate: '2026-10-07', checkOutDate: '2026-10-09' })).toBe(
      '2026-10-07 → 2026-10-09',
    );
  });

  it('keeps a separate held booking per slot for the same date', () => {
    const overnight = openBookingKey('p1', '2026-10-07', '2026-10-08', 2);
    expect(overnight).toBe('open-booking:p1:2026-10-07:2026-10-08:2');
    expect(openBookingKey('p1', '2026-10-07', '2026-10-08', 2, 'DAY')).not.toBe(overnight);
  });
});
