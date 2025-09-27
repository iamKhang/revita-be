import { Module } from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionNotificationService } from './prescription-notification.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { BoothQueueModule } from '../booth-queue/booth-queue.module';

@Module({
  imports: [PrismaModule, CacheModule, WebSocketModule, BoothQueueModule],
  controllers: [PrescriptionController],
  providers: [PrescriptionService, PrescriptionNotificationService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
