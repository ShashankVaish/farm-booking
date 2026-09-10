import { Global, Module } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';

/**
 * Global so pricing, payments and the admin panel all read the same cached
 * values without each module wiring up its own provider.
 */
@Global()
@Module({
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class SettingsModule {}
