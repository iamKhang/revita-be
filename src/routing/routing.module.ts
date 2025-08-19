import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { CounterAssignmentService } from './counter-assignment.service';
import { CounterAssignmentController } from './counter-assignment.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RoutingController, CounterAssignmentController],
  providers: [RoutingService, CounterAssignmentService, KafkaProducerService],
})
export class RoutingModule {}
