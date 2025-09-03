import { Module } from '@nestjs/common';
import { InvoicePaymentService } from './invoice-payment.service';
import { InvoicePaymentController } from './invoice-payment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PrescriptionModule } from '../prescription/prescription.module';
import { RoutingModule } from '../routing/routing.module';
import { KafkaProducerService } from '../kafka/kafka.producer';

@Module({
  imports: [PrismaModule, PrescriptionModule, RoutingModule],
  controllers: [InvoicePaymentController],
  providers: [InvoicePaymentService, KafkaProducerService],
  exports: [InvoicePaymentService],
})
export class InvoiceModule {}
