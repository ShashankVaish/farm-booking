import { Module } from '@nestjs/common';
import { AgreementsModule } from '../agreements/agreements.module';
import { LocationsModule } from '../locations/locations.module';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

@Module({
  imports: [LocationsModule, AgreementsModule],
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
