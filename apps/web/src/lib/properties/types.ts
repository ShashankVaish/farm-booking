export type PropertyType =
  | 'FARMHOUSE'
  | 'VILLA'
  | 'PARTY_HOUSE'
  | 'POOL_PROPERTY'
  | 'WEEKEND_STAY'
  | 'EVENT_VENUE';

export type ApiPropertyImage = {
  id?: string;
  url: string;
  publicId?: string | null;
  altText?: string | null;
  isCover?: boolean;
  sortOrder?: number;
};

export type ApiAmenity = {
  id?: string;
  name: string;
  slug: string;
};

export type ApiProperty = {
  id: string;
  status?: string;
  title: string;
  slug?: string;
  description?: string;
  propertyType: PropertyType | string;
  location: string;
  city: string;
  state: string;
  country?: string;
  address?: string;
  pincode?: string | null;
  latitude?: number | string;
  longitude?: number | string;
  guestCapacity: number;
  bedrooms: number;
  bathrooms: number;
  basePrice: number | string;
  weekendPrice?: number | string | null;
  extraGuestCharge?: number | string | null;
  partyRules?: string | null;
  propertyRules?: string | null;
  cancellationPolicy?: string | null;
  isPartyFriendly?: boolean;
  averageRating?: number | string;
  reviewCount?: number;
  images?: ApiPropertyImage[];
  amenities?: Array<{ amenity?: ApiAmenity; amenityId?: string } | ApiAmenity>;
  owner?: { id: string; name: string };
};

export type Paginated<T> = {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type SearchFilters = {
  city?: string;
  state?: string;
  location?: string;
  propertyType?: string;
  guests?: number;
  bedrooms?: number;
  bathrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  amenities?: string;
  checkIn?: string;
  checkOut?: string;
  partyFriendly?: boolean;
  partyAllowed?: boolean;
  pool?: boolean;
  minRating?: number;
  sort?: string;
  page?: number;
  limit?: number;
};

export type ApiReview = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  customer?: { id: string; name: string };
};

export type AvailabilityDay = {
  date: string;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
  notes?: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'OWNER' | 'ADMIN';
  phone?: string | null;
};

export const PROPERTY_TYPE_LABEL: Record<string, string> = {
  FARMHOUSE: 'Farmhouse',
  VILLA: 'Villa',
  PARTY_HOUSE: 'Party house',
  POOL_PROPERTY: 'Pool villa',
  WEEKEND_STAY: 'Weekend stay',
  EVENT_VENUE: 'Event venue',
};
