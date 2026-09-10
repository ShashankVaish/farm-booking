import {
  formatPropertyAddress,
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
} from './maps';

describe('googleMapsPlaceUrl', () => {
  it('builds a link that opens the Maps app on a phone', () => {
    const url = googleMapsPlaceUrl(28.6259346, 77.4369007);
    expect(url).toContain('https://www.google.com/maps/search/');
    expect(url).toContain('api=1');
    expect(url).toContain('query=28.6259346%2C77.4369007');
  });

  it('accepts the string form Prisma Decimal serialises to', () => {
    expect(googleMapsPlaceUrl('28.6259346', '77.4369007')).toBe(
      googleMapsPlaceUrl(28.6259346, 77.4369007),
    );
  });

  it('rounds to the precision the property record stores', () => {
    expect(googleMapsPlaceUrl(28.62593461234567, 77.4)).toContain(
      'query=28.6259346%2C77.4000000',
    );
  });

  it('returns null rather than a link to nowhere', () => {
    expect(googleMapsPlaceUrl(null, null)).toBeNull();
    expect(googleMapsPlaceUrl(undefined, undefined)).toBeNull();
    expect(googleMapsPlaceUrl('not-a-number', 77)).toBeNull();
    expect(googleMapsPlaceUrl(91, 77)).toBeNull();
    expect(googleMapsPlaceUrl(28, 181)).toBeNull();
  });

  it('treats 0,0 as unset', () => {
    // Null Island is in the Atlantic. Sending a guest there is worse than
    // sending no link at all.
    expect(googleMapsPlaceUrl(0, 0)).toBeNull();
  });

  it('still works for a genuine zero on one axis', () => {
    expect(googleMapsPlaceUrl(0, 77.4)).not.toBeNull();
  });
});

describe('googleMapsDirectionsUrl', () => {
  it('sets the property as the destination', () => {
    const url = googleMapsDirectionsUrl(28.6259346, 77.4369007);
    expect(url).toContain('https://www.google.com/maps/dir/');
    expect(url).toContain('destination=28.6259346%2C77.4369007');
  });

  it('returns null without usable coordinates', () => {
    expect(googleMapsDirectionsUrl(0, 0)).toBeNull();
  });
});

describe('formatPropertyAddress', () => {
  it('joins the parts a guest needs to find the place', () => {
    expect(
      formatPropertyAddress({
        address: 'Plot 14, Sector 3',
        location: 'Greater Noida',
        city: 'Greater Noida',
        state: 'Uttar Pradesh',
        pincode: '201310',
        country: 'India',
      }),
    ).toBe('Plot 14, Sector 3, Greater Noida, Uttar Pradesh, 201310, India');
  });

  it('drops a part the host repeated', () => {
    // Hosts routinely put the city in the free-text location line too.
    const address = formatPropertyAddress({
      address: 'Plot 14',
      location: 'Lonavala',
      city: 'Lonavala',
      state: 'Maharashtra',
    });
    expect(address).toBe('Plot 14, Lonavala, Maharashtra');
  });

  it('skips empty and whitespace-only parts', () => {
    expect(
      formatPropertyAddress({ address: '  ', city: 'Pune', state: null, pincode: undefined }),
    ).toBe('Pune');
  });

  it('returns an empty string when nothing is known', () => {
    expect(formatPropertyAddress({})).toBe('');
  });
});
