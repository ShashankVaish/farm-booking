import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GeocodingProvider,
  PlaceSuggestion,
  ReverseGeocodeResult,
} from './geocoding-provider.interface';

type GoogleGeocodeResponse = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    address_components?: Array<{
      long_name?: string;
      types?: string[];
    }>;
  }>;
};

@Injectable()
export class GoogleMapsGeocodingProvider implements GeocodingProvider {
  readonly name = 'google';
  private readonly logger = new Logger(GoogleMapsGeocodingProvider.name);

  constructor(private readonly config: ConfigService) {}

  async search(query: string): Promise<PlaceSuggestion[]> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    const result = await this.fetch(url);
    return result ? [result] : [];
  }

  async reverse(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult | null> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    return this.fetch(url);
  }

  private async fetch(url: URL): Promise<PlaceSuggestion | null> {
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!key) {
      this.logger.warn('GOOGLE_MAPS_API_KEY is not configured');
      return null;
    }
    url.searchParams.set('key', key);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const body = (await response.json()) as GoogleGeocodeResponse;
      const first = body.results?.[0];
      const lat = first?.geometry?.location?.lat;
      const lng = first?.geometry?.location?.lng;
      if (!first || lat === undefined || lng === undefined) {
        return null;
      }

      const component = (type: string) =>
        first.address_components?.find((item) => item.types?.includes(type))
          ?.long_name;

      return {
        displayName: first.formatted_address ?? `${lat}, ${lng}`,
        address: first.formatted_address,
        city:
          component('locality') ??
          component('administrative_area_level_2') ??
          component('sublocality'),
        state: component('administrative_area_level_1'),
        country: component('country'),
        pincode: component('postal_code'),
        latitude: lat,
        longitude: lng,
      };
    } catch (error: unknown) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Google geocoding failed',
      );
      return null;
    }
  }
}
