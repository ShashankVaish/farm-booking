import { Module } from '@nestjs/common';
import {
  AdminAgreementController,
  HostAgreementController,
} from './agreements.controller';
import { AgreementsService } from './agreements.service';

@Module({
  controllers: [HostAgreementController, AdminAgreementController],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}
