import { Module } from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { PrescriptionController } from './prescription.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { KafkaProducerService } from '../kafka/kafka.producer';

@Module({
  imports: [PrismaModule],
  controllers: [PrescriptionController],
  providers: [PrescriptionService, KafkaProducerService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
