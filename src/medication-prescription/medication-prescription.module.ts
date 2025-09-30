import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MedicationPrescriptionService } from './medication-prescription.service';
import { MedicationPrescriptionController } from './medication-prescription.controller';

@Module({
  imports: [PrismaModule],
  providers: [MedicationPrescriptionService],
  controllers: [MedicationPrescriptionController],
  exports: [MedicationPrescriptionService],
})
export class MedicationPrescriptionModule {}
