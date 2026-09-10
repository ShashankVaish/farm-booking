import { describe, expect, it } from 'vitest';
import {
  decodeListingMeta,
  encodeListingMeta,
  listingSlots,
  DEFAULT_LISTING_META,
} from '@/lib/host/listing-meta';

describe('listing meta encoding', () => {
  it('round-trips extra wizard fields without dropping house rules', () => {
    const encoded = encodeListingMeta(
      { ...DEFAULT_LISTING_META, beds: 6, minStay: 2, seasonal: 'Diwali 18000' },
      'No outdoor speakers after 22:00',
    );
    const decoded = decodeListingMeta(encoded);
    expect(decoded.meta.beds).toBe(6);
    expect(decoded.meta.minStay).toBe(2);
    expect(decoded.meta.seasonal).toBe('Diwali 18000');
    expect(decoded.rules).toBe('No outdoor speakers after 22:00');
  });

  it('treats legacy rules text as house rules', () => {
    const decoded = decodeListingMeta('Shoes off indoors');
    expect(decoded.rules).toBe('Shoes off indoors');
    expect(decoded.meta.beds).toBe(1);
  });
});

describe('booking slot fields', () => {
  it('round-trips day and night slots with their times', () => {
    const encoded = encodeListingMeta(
      {
        ...DEFAULT_LISTING_META,
        daySlot: true,
        dayStart: '10:00',
        dayEnd: '17:00',
        nightSlot: true,
        nightStart: '20:00',
        nightEnd: '05:00',
        overnight: false,
      },
      'No fireworks',
    );
    const { meta, rules } = decodeListingMeta(encoded);

    expect(meta.daySlot).toBe(true);
    expect(meta.dayStart).toBe('10:00');
    expect(meta.dayEnd).toBe('17:00');
    expect(meta.nightSlot).toBe(true);
    expect(meta.nightStart).toBe('20:00');
    expect(meta.nightEnd).toBe('05:00');
    expect(meta.overnight).toBe(false);
    expect(rules).toBe('No fireworks');
  });

  it('keeps a time value whole even though the block is colon separated', () => {
    // "dayStart:09:30" must split on the FIRST colon only, or the time is lost.
    const encoded = encodeListingMeta({ ...DEFAULT_LISTING_META, dayStart: '09:30' }, '');
    expect(decodeListingMeta(encoded).meta.dayStart).toBe('09:30');
  });

  it('leaves a listing saved before these fields existed bookable overnight', () => {
    // The old block has no daySlot/nightSlot/overnight lines at all. Defaulting
    // overnight to false here would make every existing listing unbookable.
    const legacy = [
      '---host-meta-v1---',
      'beds:4',
      'minStay:1',
      'checkIn:14:00',
      'checkOut:11:00',
      'smoking:Not allowed',
      'pets:Not allowed',
      'noise:',
      'seasonal:',
      'extras:',
      '---host-meta-v1---',
      'Shoes off indoors',
    ].join('\n');

    const { meta, rules } = decodeListingMeta(legacy);
    expect(meta.overnight).toBe(true);
    expect(meta.daySlot).toBe(false);
    expect(meta.nightSlot).toBe(false);
    expect(meta.beds).toBe(4);
    expect(rules).toBe('Shoes off indoors');
  });

  it('reads an explicit false rather than falling back to the default', () => {
    const encoded = encodeListingMeta({ ...DEFAULT_LISTING_META, overnight: false }, '');
    expect(decodeListingMeta(encoded).meta.overnight).toBe(false);
  });
});

describe('listingSlots', () => {
  const format = {
    range: (start: string, end: string) => `${start}-${end}`,
    time: (value: string) => value,
  };

  it('lists only what the host offers, day first', () => {
    const slots = listingSlots(
      { ...DEFAULT_LISTING_META, daySlot: true, nightSlot: true, overnight: true },
      format,
    );
    expect(slots.map((slot) => slot.key)).toEqual(['day', 'night', 'overnight']);
  });

  it('omits a slot that is switched off', () => {
    const slots = listingSlots(
      { ...DEFAULT_LISTING_META, daySlot: false, nightSlot: true, overnight: false },
      format,
    );
    expect(slots.map((slot) => slot.key)).toEqual(['night']);
    expect(slots[0].detail).toBe('19:00-06:00');
  });

  it('describes an overnight stay with both ends of the day', () => {
    const slots = listingSlots({ ...DEFAULT_LISTING_META, overnight: true }, format);
    expect(slots[0].detail).toBe('Check in after 14:00, out by 11:00');
  });
});
