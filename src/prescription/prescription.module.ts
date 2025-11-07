import { Module, forwardRef } from '@nestjs/common';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionNotificationService } from './prescription-notification.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { WebSocketModule } from '../websocket/websocket.module'; 
import { PrescriptionService } from './prescription.service';
import { PrescriptionServiceManagementService } from '../service/prescription-service-management.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PrismaModule, CacheModule, WebSocketModule],
  controllers: [PrescriptionController],
  providers: [
    PrescriptionService,
    {
      provide: PrescriptionServiceManagementService,
      useFactory: (prisma: PrismaService, prescriptionService: PrescriptionService) => {
        const service = new PrescriptionServiceManagementService(prisma);
        (service as any).prescriptionService = prescriptionService;
        return service;
      },
      inject: [PrismaService, PrescriptionService],
    },
  ],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
