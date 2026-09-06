import { decodeListingMeta, encodeListingMeta } from '@/lib/host/listing-meta';
import type { ListingDraft } from '@/lib/host/listing-types';
import type { ApiProperty } from '@/lib/properties/types';

export function toPropertyPayload(draft: ListingDraft) {
  const propertyRules = encodeListingMeta(draft.meta, draft.houseRules);
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    propertyType: draft.propertyType,
    location: draft.location.location.trim() || [draft.location.city, draft.location.state].filter(Boolean).join(', '),
    city: draft.location.city.trim(),
    state: draft.location.state.trim(),
    country: draft.location.country.trim() || 'India',
    address: draft.location.address.trim(),
    pincode: draft.location.pincode.trim(),
    latitude: draft.location.latitude as number,
    longitude: draft.location.longitude as number,
    guestCapacity: draft.guestCapacity,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    basePrice: draft.weekdayPrice,
    weekendPrice: draft.weekendPrice || undefined,
    extraGuestCharge: draft.extraGuestCharge || undefined,
    partyRules: draft.partyRules.trim() || undefined,
    propertyRules,
    cancellationPolicy: draft.cancellationPolicy.trim() || undefined,
    isPartyFriendly: draft.isPartyFriendly,
    amenityIds: draft.amenityIds,
    images: draft.images.map((image, index) => ({
      url: image.url,
      publicId: image.publicId,
      altText: image.alt,
      sortOrder: index,
      isCover: image.isCover || index === 0,
    })),
  };
}

export function fromApiProperty(property: ApiProperty): ListingDraft {
  const { meta, rules } = decodeListingMeta(property.propertyRules);
  const amenityIds = (property.amenities ?? [])
    .map((entry) => {
      if ('amenityId' in entry && entry.amenityId) return entry.amenityId;
      if ('amenity' in entry && entry.amenity?.id) return entry.amenity.id;
      if ('id' in entry && typeof entry.id === 'string') return entry.id;
      return null;
    })
    .filter((id): id is string => Boolean(id));

  return {
    id: property.id,
    status: property.status ?? 'DRAFT',
    title: property.title,
    description: property.description ?? '',
    propertyType: (property.propertyType as ListingDraft['propertyType']) || 'FARMHOUSE',
    guestCapacity: property.guestCapacity,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    weekdayPrice: Number(property.basePrice) || 0,
    weekendPrice: Number(property.weekendPrice ?? 0) || 0,
    extraGuestCharge: Number(property.extraGuestCharge ?? 0) || 0,
    houseRules: rules,
    partyRules: property.partyRules ?? '',
    cancellationPolicy: property.cancellationPolicy ?? '',
    isPartyFriendly: Boolean(property.isPartyFriendly),
    amenityIds,
    images: (property.images ?? []).map((image, index) => ({
      url: image.url,
      publicId: image.publicId ?? undefined,
      alt: image.altText || property.title,
      isCover: image.isCover ?? index === 0,
    })),
    location: {
      query: '',
      address: property.address ?? '',
      city: property.city,
      state: property.state,
      pincode: property.pincode ?? '',
      country: property.country ?? 'India',
      location: property.location,
      latitude: Number(property.latitude),
      longitude: Number(property.longitude),
      confirmed: true,
      confirmedAddress: property.address ?? property.location,
    },
    meta,
  };
}
