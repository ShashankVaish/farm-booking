import { Global, Module } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { BackgroundWork } from '../common/background-work.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, AuditService, BackgroundWork],
  exports: [PrismaService, AuditService, BackgroundWork],
})
export class PrismaModule {}
