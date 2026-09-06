import { describe, expect, it } from 'vitest';
import { validateListingLocation, type LocationDraft } from '@/lib/host/listing-location';

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
