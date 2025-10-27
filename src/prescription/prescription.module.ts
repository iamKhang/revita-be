import { Module } from '@nestjs/common';
import { PrescriptionController } from './prescription.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { PrescriptionService } from './prescription.service';
import { PrescriptionServiceManagementService } from '../service/prescription-service-management.service';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [PrismaModule, CacheModule, WebSocketModule],
  controllers: [PrescriptionController],
  providers: [PrescriptionService, PrescriptionServiceManagementService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
