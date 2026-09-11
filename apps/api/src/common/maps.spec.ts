import { formatPropertyAddress, mapDirectionsUrl, mapPlaceUrl } from './maps';

describe('mapPlaceUrl', () => {
  it('drops a marker at the property on OpenStreetMap', () => {
    // OSM, not Google: the site has no Maps billing account, and an unbilled
    // Google project watermarks every tile.
    const url = mapPlaceUrl(28.6259346, 77.4369007);
    expect(url).toContain('https://www.openstreetmap.org/');
    expect(url).toContain('mlat=28.6259346');
    expect(url).toContain('mlon=77.4369007');
  });

  it('never points at a Google endpoint', () => {
    expect(mapPlaceUrl(28.6, 77.4)).not.toContain('google');
    expect(mapDirectionsUrl(28.6, 77.4)).not.toContain('google');
  });

  it('accepts the string form Prisma Decimal serialises to', () => {
    expect(mapPlaceUrl('28.6259346', '77.4369007')).toBe(
      mapPlaceUrl(28.6259346, 77.4369007),
    );
  });

  it('rounds to the precision the property record stores', () => {
    expect(mapPlaceUrl(28.62593461234567, 77.4)).toContain('mlat=28.6259346');
  });

  it('returns null rather than a link to nowhere', () => {
    expect(mapPlaceUrl(null, null)).toBeNull();
    expect(mapPlaceUrl(undefined, undefined)).toBeNull();
    expect(mapPlaceUrl('not-a-number', 77)).toBeNull();
    expect(mapPlaceUrl(91, 77)).toBeNull();
    expect(mapPlaceUrl(28, 181)).toBeNull();
  });

  it('treats 0,0 as unset', () => {
    // Null Island is in the Atlantic. Sending a guest there is worse than
    // sending no link at all.
    expect(mapPlaceUrl(0, 0)).toBeNull();
  });

  it('still works for a genuine zero on one axis', () => {
    expect(mapPlaceUrl(0, 77.4)).not.toBeNull();
  });
});

describe('mapDirectionsUrl', () => {
  it('sets the property as the destination', () => {
    const url = mapDirectionsUrl(28.6259346, 77.4369007);
    expect(url).toContain('https://www.openstreetmap.org/directions');
    expect(url).toContain('to=28.6259346%2C77.4369007');
  });

  it('returns null without usable coordinates', () => {
    expect(mapDirectionsUrl(0, 0)).toBeNull();
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
      formatPropertyAddress({
        address: '  ',
        city: 'Pune',
        state: null,
        pincode: undefined,
      }),
    ).toBe('Pune');
  });

  it('returns an empty string when nothing is known', () => {
    expect(formatPropertyAddress({})).toBe('');
  });
});
