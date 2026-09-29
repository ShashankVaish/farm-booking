import type { LocationDraft } from '@/lib/host/listing-location';
import type { ListingMeta } from '@/lib/host/listing-meta';
import { DEFAULT_LISTING_META } from '@/lib/host/listing-meta';
import type { PropertyType } from '@/lib/properties/types';

export type ListingImageDraft = {
  url: string;
  publicId?: string;
  alt: string;
  isCover: boolean;
};

export type ListingDraft = {
  id?: string;
  status?: string;
  title: string;
  description: string;
  propertyType: PropertyType;
  guestCapacity: number;
  bedrooms: number;
  bathrooms: number;
  weekdayPrice: number;
  weekendPrice: number;
  extraGuestCharge: number;
  /** Flat price for one day party; 0 means "same as a night party". */
  dayPartyPrice: number;
  houseRules: string;
  partyRules: string;
  cancellationPolicy: string;
  isPartyFriendly: boolean;
  isAdultOnly: boolean;
  isCoupleFriendly: boolean;
  amenityIds: string[];
  images: ListingImageDraft[];
  location: LocationDraft;
  meta: ListingMeta;
};

export const emptyListing = (): ListingDraft => ({
  title: '',
  description: '',
  propertyType: 'FARMHOUSE',
  guestCapacity: 8,
  bedrooms: 2,
  bathrooms: 2,
  weekdayPrice: 0,
  weekendPrice: 0,
  extraGuestCharge: 0,
  dayPartyPrice: 0,
  houseRules: '',
  partyRules: '',
  cancellationPolicy: 'Free cancellation up to 7 days before check-in. 50% refund thereafter.',
  isPartyFriendly: false,
  isAdultOnly: false,
  isCoupleFriendly: false,
  amenityIds: [],
  images: [],
  location: {
    query: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    location: '',
    latitude: null,
    longitude: null,
    confirmed: false,
    confirmedAddress: '',
  },
  // A new listing starts with the night party on; the host adds a day party.
  meta: { ...DEFAULT_LISTING_META, nightSlot: true },
});

export const WIZARD_STEPS = [
  'Basics',
  'Location',
  'Capacity',
  'Amenities',
  'Photos',
  'Pricing',
  'Rules',
  'Availability',
  'Preview',
  'Verification',
  'Submit',
] as const;
