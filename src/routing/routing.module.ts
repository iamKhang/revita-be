import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { ServiceModule } from '../service/service.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { CounterAssignmentService } from './counter-assignment.service';
import { CounterAssignmentController } from './counter-assignment.controller';
import { TakeNumberModule } from './take-number.module';
import { StreamConsumerService } from './stream-consumer.service';

@Module({
  imports: [PrismaModule, CacheModule, ServiceModule, WebSocketModule, TakeNumberModule],
  controllers: [RoutingController, CounterAssignmentController],
  providers: [RoutingService, CounterAssignmentService, KafkaProducerService, StreamConsumerService],
  exports: [RoutingService, CounterAssignmentService],
})
export class RoutingModule {}
