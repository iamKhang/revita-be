import { Module } from '@nestjs/common';
import { InvoicePaymentService } from './invoice-payment.service';
import { InvoicePaymentController } from './invoice-payment.controller';
import { LoyaltyService } from './loyalty.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrescriptionModule } from '../prescription/prescription.module';
import { RoutingModule } from '../routing/routing.module';
import { CacheModule } from '../cache/cache.module';
import { PayOsModule } from '../payos/payos.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    PrismaModule,
    PrescriptionModule,
    RoutingModule,
    CacheModule,
    PayOsModule,
    WebSocketModule,
  ],
  controllers: [InvoicePaymentController],
  providers: [InvoicePaymentService, LoyaltyService],
  exports: [InvoicePaymentService, LoyaltyService],
})
export class InvoiceModule {}
