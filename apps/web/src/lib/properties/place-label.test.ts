import { describe, expect, it } from 'vitest';
import { areaName, placeLabel } from '@/lib/properties/place-label';

describe('areaName', () => {
  it('shows the city and state the host last saved, not a stale geocoder label', () => {
    expect(
      areaName({ location: 'Sambhal, Uttar Pradesh, 244302, India', city: 'noida', state: 'Uttar Pradesh' }),
    ).toBe('Noida, Uttar Pradesh');
  });

  it('keeps a short locality in front of the city', () => {
    expect(areaName({ location: 'Tungarli', city: 'Lonavala', state: 'Maharashtra' })).toBe(
      'Tungarli, Lonavala, Maharashtra',
    );
  });

  it('never repeats a part', () => {
    expect(areaName({ location: 'Noida', city: 'noida', state: 'Uttar Pradesh' })).toBe('Noida, Uttar Pradesh');
    expect(placeLabel('Goa', 'goa', '', null, 'Goa')).toBe('Goa');
  });
});
