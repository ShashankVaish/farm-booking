import { describe, expect, it } from 'vitest';
import { toQueryString } from '@/lib/api/query';
import { propertyBadge, toPropertyCard } from '@/lib/properties/map-property';
import type { ApiProperty } from '@/lib/properties/types';

const sample: ApiProperty = {
  id: 'p1',
  title: 'Courtyard House',
  propertyType: 'FARMHOUSE',
  location: 'Tungarli',
  city: 'Lonavala',
  state: 'Maharashtra',
  guestCapacity: 16,
  bedrooms: 5,
  bathrooms: 5,
  basePrice: '28000.00',
  isPartyFriendly: true,
  averageRating: '4.80',
  reviewCount: 12,
  images: [{ url: 'https://cdn.example/cover.jpg', altText: 'Pool', isCover: true }],
  amenities: [{ amenity: { id: 'a1', name: 'Pool', slug: 'pool' } }],
};

describe('toQueryString', () => {
  it('omits empty values', () => {
    expect(toQueryString({ city: 'Pune', guests: undefined, pool: true })).toBe('?city=Pune&pool=true');
  });
});

describe('toPropertyCard', () => {
  it('maps API properties into card models', () => {
    const card = toPropertyCard(sample);
    expect(card.name).toBe('Courtyard House');
    expect(card.price).toBe(28000);
    expect(card.location).toContain('Tungarli');
    expect(card.amenities).toEqual(['Pool']);
    expect(card.image?.src).toContain('cdn.example');
    expect(propertyBadge(sample)).toBe('Party ready');
  });
});
