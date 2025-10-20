import { Module } from '@nestjs/common';
import { PrescriptionController } from './prescription.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { PrescriptionService } from './prescription.service';
import { PrescriptionServiceManagementService } from '../service/prescription-service-management.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [PrescriptionController],
  providers: [PrescriptionService, PrescriptionServiceManagementService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
