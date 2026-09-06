import { Injectable, Logger } from '@nestjs/common';
import type {
  GeocodingProvider,
  PlaceSuggestion,
  ReverseGeocodeResult,
} from './geocoding-provider.interface';

type NominatimHit = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
    road?: string;
    suburb?: string;
    neighbourhood?: string;
  };
};

@Injectable()
export class NominatimGeocodingProvider implements GeocodingProvider {
  readonly name = 'nominatim';
  private readonly logger = new Logger(NominatimGeocodingProvider.name);

  async search(query: string): Promise<PlaceSuggestion[]> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '8');

    const hits = await this.fetchJson<NominatimHit[]>(url);
    return (hits ?? [])
      .map((hit) => this.toSuggestion(hit))
      .filter(Boolean) as PlaceSuggestion[];
  }

  async reverse(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult | null> {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');

    const hit = await this.fetchJson<NominatimHit>(url);
    if (!hit) {
      return null;
    }
    return this.toSuggestion(hit);
  }

  private toSuggestion(hit: NominatimHit): PlaceSuggestion | null {
    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    const address = hit.address ?? {};
    const city = address.city ?? address.town ?? address.village;
    const street = [address.road, address.suburb ?? address.neighbourhood]
      .filter(Boolean)
      .join(', ');

    return {
      displayName: hit.display_name ?? `${latitude}, ${longitude}`,
      address: street || hit.display_name,
      city,
      state: address.state,
      country: address.country,
      pincode: address.postcode,
      latitude,
      longitude,
    };
  }

  private async fetchJson<T>(url: URL): Promise<T | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'farmhouse-booking-platform/1.0 (backend geocoding)',
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        this.logger.warn(`Geocoding provider returned ${response.status}`);
        return null;
      }
      return (await response.json()) as T;
    } catch (error: unknown) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Geocoding request failed',
      );
      return null;
    }
  }
}
