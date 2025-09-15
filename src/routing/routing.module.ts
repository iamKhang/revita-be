import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { ServiceModule } from '../service/service.module';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { CounterAssignmentService } from './counter-assignment.service';
import { CounterAssignmentController } from './counter-assignment.controller';

@Module({
  imports: [PrismaModule, CacheModule, ServiceModule],
  controllers: [RoutingController, CounterAssignmentController],
  providers: [RoutingService, CounterAssignmentService, KafkaProducerService],
  exports: [RoutingService, CounterAssignmentService],
})
export class RoutingModule {}
