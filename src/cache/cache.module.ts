import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisStreamService } from './redis-stream.service';

@Module({
  providers: [RedisService, RedisStreamService],
  exports: [RedisService, RedisStreamService],
})
export class CacheModule {}
