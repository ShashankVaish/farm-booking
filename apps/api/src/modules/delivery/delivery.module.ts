import { Global, Module } from '@nestjs/common';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { DeliveryQueue } from './delivery-queue.service';

/**
 * Global so notifications, listings and anything else that sends a message can
 * queue it without re-importing this module. One queue, one worker per process.
 */
@Global()
@Module({
  providers: [DeliveryQueue, WhatsAppService],
  exports: [DeliveryQueue, WhatsAppService],
})
export class DeliveryModule {}
