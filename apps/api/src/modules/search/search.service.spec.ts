import { SearchService } from './search.service';

describe('SearchService filters', () => {
  const service = new SearchService({} as never);

  it('only searches APPROVED properties and applies core filters in SQL where clauses', () => {
    const where = service.buildWhere({
      city: 'Pune',
      state: 'Maharashtra',
      propertyType: 'FARMHOUSE',
      guests: 8,
      bedrooms: 3,
      bathrooms: 2,
      minPrice: 5000,
      maxPrice: 20000,
      amenities: 'a1,a2',
      partyFriendly: true,
      checkIn: '2026-10-01',
      checkOut: '2026-10-03',
    });

    expect(where.status).toBe('APPROVED');
    expect(where.city).toEqual({ equals: 'Pune', mode: 'insensitive' });
    expect(where.guestCapacity).toEqual({ gte: 8 });
    expect(where.isPartyFriendly).toBe(true);
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { amenities: { some: { amenityId: 'a1' } } },
        { amenities: { some: { amenityId: 'a2' } } },
        { bookingNights: { none: { date: expect.any(Object) } } },
      ]),
    );
  });
});
