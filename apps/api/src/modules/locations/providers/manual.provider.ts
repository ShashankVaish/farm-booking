import { Injectable } from '@nestjs/common';
import type {
  GeocodingProvider,
  PlaceSuggestion,
  ReverseGeocodeResult,
} from './geocoding-provider.interface';

@Injectable()
export class ManualGeocodingProvider implements GeocodingProvider {
  readonly name = 'manual';

  search(query: string): Promise<PlaceSuggestion[]> {
    if (!query.trim()) {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }

  reverse(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult | null> {
    return Promise.resolve({
      displayName: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      latitude,
      longitude,
    });
  }
}
