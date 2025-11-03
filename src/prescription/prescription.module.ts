import { Module } from '@nestjs/common';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionNotificationService } from './prescription-notification.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { WebSocketModule } from '../websocket/websocket.module'; 
import { BoothQueueModule } from '../booth-queue/booth-queue.module';
import { PrescriptionService } from './prescription.service';
import { PrescriptionServiceManagementService } from '../service/prescription-service-management.service';

@Module({
  imports: [PrismaModule, CacheModule, WebSocketModule, BoothQueueModule],
  controllers: [PrescriptionController],
  providers: [PrescriptionService, PrescriptionServiceManagementService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
