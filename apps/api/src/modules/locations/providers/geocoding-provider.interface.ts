export interface PlaceSuggestion {
  displayName: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude: number;
  longitude: number;
}

export type ReverseGeocodeResult = PlaceSuggestion;

export interface GeocodingProvider {
  readonly name: string;
  search(query: string): Promise<PlaceSuggestion[]>;
  reverse(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult | null>;
}

export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');
