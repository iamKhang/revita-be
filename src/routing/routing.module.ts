import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RoutingService } from './routing.service'; 
import { RoutingController } from './routing.controller'; 
import { KafkaProducerService } from '../kafka/kafka.producer';

@Module({
  imports: [PrismaModule],
  controllers: [RoutingController],
  providers: [RoutingService, KafkaProducerService],
})
export class RoutingModule {}


