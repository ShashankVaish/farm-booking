import { Inject, Injectable } from '@nestjs/common';
import { assertValidCoordinates } from './geo';
import { ConfirmLocationDto, ReverseGeocodeDto } from './dto/location.dto';
import {
  GEOCODING_PROVIDER,
  type GeocodingProvider,
  type PlaceSuggestion,
} from './providers/geocoding-provider.interface';

@Injectable()
export class LocationsService {
  constructor(
    @Inject(GEOCODING_PROVIDER) private readonly geocoder: GeocodingProvider,
  ) {}

  search(query: string): Promise<PlaceSuggestion[]> {
    return this.geocoder.search(query.trim());
  }

  async reverse(dto: ReverseGeocodeDto) {
    assertValidCoordinates(dto.latitude, dto.longitude);
    const result = await this.geocoder.reverse(dto.latitude, dto.longitude);
    return (
      result ?? {
        displayName: `${dto.latitude.toFixed(6)}, ${dto.longitude.toFixed(6)}`,
        latitude: dto.latitude,
        longitude: dto.longitude,
      }
    );
  }

  async confirm(dto: ConfirmLocationDto) {
    assertValidCoordinates(dto.latitude, dto.longitude);
    const resolved = await this.geocoder.reverse(dto.latitude, dto.longitude);

    return {
      location: (
        dto.displayName ||
        resolved?.displayName ||
        [dto.city, dto.state].filter(Boolean).join(', ')
      ).trim(),
      address: dto.address || resolved?.address || resolved?.displayName || '',
      city: dto.city || resolved?.city || '',
      state: dto.state || resolved?.state || '',
      country: dto.country || resolved?.country || 'India',
      pincode: dto.pincode || resolved?.pincode || undefined,
      latitude: dto.latitude,
      longitude: dto.longitude,
      provider: this.geocoder.name,
      confirmed: true,
    };
  }
}
