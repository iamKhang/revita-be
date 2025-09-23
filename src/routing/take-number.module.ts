import { Module } from '@nestjs/common';
import { TakeNumberController } from './take-number.controller';
import { TakeNumberService } from './take-number.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [PrismaModule, CacheModule, WebSocketModule],
  controllers: [TakeNumberController],
  providers: [TakeNumberService],
  exports: [TakeNumberService],
})
export class TakeNumberModule {}

