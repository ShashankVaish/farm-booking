import { amenityName } from '@/lib/properties/map-property';
import type { ApiProperty } from '@/lib/properties/types';
import { PROPERTY_TYPE_LABEL } from '@/lib/properties/types';

export function propertyJsonLd(property: ApiProperty, siteUrl: string) {
  const url = siteUrl ? `${siteUrl}/properties/${property.id}` : `/properties/${property.id}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: property.title,
    description: property.description,
    url,
    address: {
      '@type': 'PostalAddress',
      streetAddress: property.address,
      addressLocality: property.city,
      addressRegion: property.state,
      addressCountry: property.country ?? 'IN',
      postalCode: property.pincode ?? undefined,
    },
    geo:
      property.latitude && property.longitude
        ? {
            '@type': 'GeoCoordinates',
            latitude: Number(property.latitude),
            longitude: Number(property.longitude),
          }
        : undefined,
    starRating: {
      '@type': 'Rating',
      ratingValue: Number(property.averageRating ?? 0),
    },
    amenityFeature: (property.amenities ?? []).map((entry) => ({
      '@type': 'LocationFeatureSpecification',
      name: amenityName(entry),
    })),
    additionalType: PROPERTY_TYPE_LABEL[property.propertyType],
  };
}
