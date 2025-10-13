import { Module } from '@nestjs/common';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';
import { PrescriptionServiceManagementService } from './prescription-service-management.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceCategoryController } from './service-category.controller';
import { ServiceCategoryService } from './service-category.service';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceController, ServiceCategoryController],
  providers: [
    ServiceService,
    PrescriptionServiceManagementService,
    ServiceCategoryService,
  ],
  exports: [
    ServiceService,
    PrescriptionServiceManagementService,
    ServiceCategoryService,
  ],
})
export class ServiceModule {}
