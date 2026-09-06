import { occupancyRate } from './owner-metrics';

describe('owner occupancy', () => {
  it('returns 0 when the owner has no properties', () => {
    expect(occupancyRate(10, 0, 30)).toBe(0);
  });

  it('caps occupancy at 100%', () => {
    expect(occupancyRate(40, 1, 30)).toBe(1);
  });

  it('computes booked nights over inventory', () => {
    expect(occupancyRate(15, 2, 30)).toBe(0.25);
  });
});
