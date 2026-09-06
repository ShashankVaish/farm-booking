import { describe, expect, it } from 'vitest';
import { decodeListingMeta, encodeListingMeta, DEFAULT_LISTING_META } from '@/lib/host/listing-meta';

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
