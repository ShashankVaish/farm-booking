import type { PropertyCardModel } from '@/components/hospitality/property-card';
import type { ApiProperty } from '@/lib/properties/types';

export const demoProperties: PropertyCardModel[] = [
  {
    id: 'courtyard-lonavala',
    name: 'Courtyard House',
    type: 'Farmhouse',
    location: 'Lonavala, Maharashtra',
    rating: 4.8,
    reviewCount: 64,
    guests: 16,
    bedrooms: 5,
    amenities: ['Pool', 'Lawn', 'BBQ'],
    price: 28000,
    badge: 'Party ready',
    href: '/properties/courtyard-lonavala',
    imageTone: 'lawn',
  },
  {
    id: 'pool-villa-alibaug',
    name: 'South Veranda',
    type: 'Private villa',
    location: 'Alibaug, Maharashtra',
    rating: 4.9,
    reviewCount: 41,
    guests: 10,
    bedrooms: 4,
    amenities: ['Pool', 'Chef', 'Parking'],
    price: 42000,
    badge: 'Pool',
    href: '/properties/pool-villa-alibaug',
    imageTone: 'pool',
  },
  {
    id: 'evening-house-udaipur',
    name: 'Lake Edge Pavilion',
    type: 'Event venue',
    location: 'Udaipur, Rajasthan',
    rating: 4.7,
    reviewCount: 28,
    guests: 40,
    bedrooms: 8,
    amenities: ['Lawn', 'Dining', 'Music'],
    price: 65000,
    badge: 'Events',
    href: '/properties/evening-house-udaipur',
    imageTone: 'night',
  },
];

const DEMO_TYPE: Record<string, ApiProperty['propertyType']> = {
  'courtyard-lonavala': 'FARMHOUSE',
  'pool-villa-alibaug': 'VILLA',
  'evening-house-udaipur': 'EVENT_VENUE',
};

export function demoPropertyToApi(id: string): ApiProperty | null {
  const card = demoProperties.find((item) => item.id === id);
  if (!card) {
    return null;
  }
  const [city, state] = card.location.split(',').map((part) => part.trim());
  return {
    id: card.id,
    slug: card.id,
    title: card.name,
    description: `${card.name} is a private ${card.type.toLowerCase()} in ${card.location}, with space for ${card.guests} guests and ${card.bedrooms} bedrooms.`,
    propertyType: DEMO_TYPE[card.id] ?? 'FARMHOUSE',
    location: card.location,
    city: city || card.location,
    state: state || 'Maharashtra',
    country: 'India',
    address: card.location,
    guestCapacity: card.guests,
    bedrooms: card.bedrooms,
    bathrooms: Math.max(1, Math.round(card.bedrooms * 0.8)),
    basePrice: card.price,
    weekendPrice: Math.round(card.price * 1.15),
    extraGuestCharge: 1500,
    isPartyFriendly: card.badge === 'Party ready' || card.badge === 'Events',
    averageRating: card.rating,
    reviewCount: card.reviewCount,
    amenities: card.amenities.map((name) => ({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
    })),
    cancellationPolicy: 'Free cancellation up to 7 days before check-in.',
  };
}
