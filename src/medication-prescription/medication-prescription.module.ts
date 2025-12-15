import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MedicationPrescriptionService } from './medication-prescription.service';
import { MedicationPrescriptionController } from './medication-prescription.controller';
import { DrugCatalogModule } from '../drug-catalog/drug-catalog.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, DrugCatalogModule, EmailModule],
  providers: [MedicationPrescriptionService],
  controllers: [MedicationPrescriptionController],
  exports: [MedicationPrescriptionService],
})
export class MedicationPrescriptionModule {}
