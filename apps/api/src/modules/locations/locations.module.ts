import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { GEOCODING_PROVIDER } from './providers/geocoding-provider.interface';
import { GoogleMapsGeocodingProvider } from './providers/google-maps.provider';
import { ManualGeocodingProvider } from './providers/manual.provider';
import { NominatimGeocodingProvider } from './providers/nominatim.provider';

@Module({
  imports: [ConfigModule],
  controllers: [LocationsController],
  providers: [
    NominatimGeocodingProvider,
    GoogleMapsGeocodingProvider,
    ManualGeocodingProvider,
    {
      provide: GEOCODING_PROVIDER,
      inject: [
        ConfigService,
        NominatimGeocodingProvider,
        GoogleMapsGeocodingProvider,
        ManualGeocodingProvider,
      ],
      useFactory: (
        config: ConfigService,
        nominatim: NominatimGeocodingProvider,
        google: GoogleMapsGeocodingProvider,
        manual: ManualGeocodingProvider,
      ) => {
        const provider = (
          config.get<string>('GEOCODING_PROVIDER') ?? 'nominatim'
        ).toLowerCase();
        if (provider === 'google') {
          return google;
        }
        if (provider === 'manual') {
          return manual;
        }
        return nominatim;
      },
    },
    LocationsService,
  ],
  exports: [LocationsService, GEOCODING_PROVIDER],
})
export class LocationsModule {}
