import type { PropertyCardModel } from '@/components/hospitality/property-card';

/**
 * Sample cards for the design-system showcase only. These must never be
 * rendered on a guest-facing page: a placeholder listing is not bookable, and
 * showing one implies inventory that does not exist.
 */
export const demoProperties: PropertyCardModel[] = [
  {
    id: 'courtyard-lonavala',
    name: 'Courtyard House',
    type: 'Farmhouse',
    location: 'Lonavala, Maharashtra',
    trusted: true,
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
    guests: 40,
    bedrooms: 8,
    amenities: ['Lawn', 'Dining', 'Music'],
    price: 65000,
    badge: 'Events',
    href: '/properties/evening-house-udaipur',
    imageTone: 'night',
  },
];
