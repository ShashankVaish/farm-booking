import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HostKycService } from './host-kyc.service';
import { OwnerController } from './owner.controller';
import { OwnerService } from './owner.service';

@Module({
  imports: [AuthModule],
  controllers: [OwnerController],
  providers: [OwnerService, HostKycService],
  exports: [HostKycService],
})
export class OwnerModule {}
