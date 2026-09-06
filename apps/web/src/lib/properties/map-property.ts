import type { PropertyCardModel } from '@/components/hospitality/property-card';
import type { MediaAsset } from '@/lib/media/types';
import type { ApiAmenity, ApiProperty } from '@/lib/properties/types';
import { PROPERTY_TYPE_LABEL } from '@/lib/properties/types';

function money(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function amenityName(
  entry: { amenity?: ApiAmenity; amenityId?: string } | ApiAmenity,
): string | undefined {
  if ('name' in entry && typeof entry.name === 'string') {
    return entry.name;
  }
  if ('amenity' in entry) {
    return entry.amenity?.name;
  }
  return undefined;
}

function amenityNames(property: ApiProperty): string[] {
  return (property.amenities ?? []).map(amenityName).filter((name): name is string => Boolean(name));
}

export function propertyBadge(property: ApiProperty): string | undefined {
  if (property.isPartyFriendly) return 'Party ready';
  if (property.propertyType === 'POOL_PROPERTY') return 'Pool';
  if (property.propertyType === 'EVENT_VENUE' || property.propertyType === 'PARTY_HOUSE') {
    return 'Events';
  }
  if (money(property.averageRating) >= 4.8) return 'Highly rated';
  return undefined;
}

export function coverImage(property: ApiProperty): MediaAsset | null {
  const images = [...(property.images ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const cover = images.find((image) => image.isCover) ?? images[0];
  if (!cover?.url) {
    return null;
  }
  return {
    src: cover.url,
    alt: cover.altText || property.title,
  };
}

export function toPropertyCard(property: ApiProperty): PropertyCardModel {
  const type = PROPERTY_TYPE_LABEL[property.propertyType] ?? 'Stay';
  return {
    id: property.id,
    name: property.title,
    type,
    location: [property.location || property.city, property.state].filter(Boolean).join(', '),
    rating: money(property.averageRating),
    reviewCount: property.reviewCount ?? 0,
    guests: property.guestCapacity,
    bedrooms: property.bedrooms,
    amenities: amenityNames(property),
    price: money(property.basePrice),
    badge: propertyBadge(property),
    href: `/properties/${property.id}`,
    image: coverImage(property),
    imageTone:
      property.propertyType === 'POOL_PROPERTY'
        ? 'pool'
        : property.isPartyFriendly
          ? 'night'
          : 'lawn',
  };
}
