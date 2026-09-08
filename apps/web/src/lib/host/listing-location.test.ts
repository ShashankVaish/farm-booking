import { describe, expect, it } from 'vitest';
import {
  roundCoordinate,
  validateListingLocation,
  type LocationDraft,
} from '@/lib/host/listing-location';

function draft(overrides: Partial<LocationDraft> = {}): LocationDraft {
  return {
    query: '',
    address: 'Survey 12, Village Road',
    city: 'Alibag',
    state: 'Maharashtra',
    pincode: '402201',
    country: 'India',
    location: 'Alibag, Maharashtra',
    latitude: 18.6411,
    longitude: 72.8722,
    confirmed: true,
    confirmedAddress: 'Survey 12, Village Road',
    ...overrides,
  };
}

describe('listing location validation', () => {
  it('accepts a confirmed Indian address with valid coordinates', () => {
    expect(validateListingLocation(draft())).toEqual({});
  });

  it('rejects an unconfirmed pin and invalid PIN code', () => {
    const errors = validateListingLocation(draft({ confirmed: false, pincode: '12', latitude: 91 }));
    expect(errors.pincode).toBeDefined();
    expect(errors.latitude).toBeDefined();
    expect(errors.confirmed).toBeDefined();
  });

  it('rejects null island coordinates', () => {
    const errors = validateListingLocation(draft({ latitude: 0, longitude: 0 }));
    expect(errors.latitude).toBeDefined();
  });
});

describe('roundCoordinate', () => {
  it('trims browser GPS precision to the 7 decimals the API accepts', () => {
    // navigator.geolocation returns far more precision than the DTO allows.
    const rounded = roundCoordinate(28.61393891234567);
    expect(rounded).toBe(28.6139389);
    expect(String(rounded).split('.')[1]?.length).toBeLessThanOrEqual(7);
  });

  it('leaves already-short coordinates untouched', () => {
    expect(roundCoordinate(72.8722)).toBe(72.8722);
    expect(roundCoordinate(0)).toBe(0);
  });

  it('returns NaN for unusable input so validation can reject it', () => {
    expect(roundCoordinate(Number.NaN)).toBeNaN();
    expect(roundCoordinate(Number.POSITIVE_INFINITY)).toBeNaN();
  });
});
