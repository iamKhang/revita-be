import { Module } from '@nestjs/common';
import { BoothQueueService } from './booth-queue.service';
import { PriorityCalculatorService } from './priority-calculator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [PrismaModule, CacheModule, WebSocketModule],
  providers: [BoothQueueService, PriorityCalculatorService],
  exports: [BoothQueueService, PriorityCalculatorService],
})
export class BoothQueueModule {}

