import { Module } from '@nestjs/common';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';
import { PrescriptionServiceManagementService } from './prescription-service-management.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceController],
  providers: [ServiceService, PrescriptionServiceManagementService],
  exports: [ServiceService, PrescriptionServiceManagementService],
})
export class ServiceModule {}
