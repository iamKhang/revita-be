import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Public } from '../rbac/public.decorator';
import { TakeNumberService, TakeNumberResult } from './take-number.service';
import { TakeNumberDto } from './dto/take-number.dto';
import { RedisStreamService } from '../cache/redis-stream.service';
import { RedisService } from '../cache/redis.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('take-number')
export class TakeNumberController {
  constructor(
    private readonly takeNumberService: TakeNumberService,
    private readonly redisStream: RedisStreamService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Post('take')
  async takeNumber(@Body() body: TakeNumberDto): Promise<TakeNumberResult> {
    return this.takeNumberService.takeNumber(body);
  }

  @Public()
  @Get('tickets')
  async getAllTickets(): Promise<{ tickets: any[] }> {
    const tickets = await this.redisStream.getTicketsFromStream();
    return { tickets };
  }

  @Public()
  @Get('tickets/counter/:counterId')
  async getCounterTickets(@Param('counterId') counterId: string): Promise<{ tickets: any[] }> {
    const tickets = await this.redisStream.getCounterTickets(counterId);
    return { tickets };
  }

  @Public()
  @Get('stream/info')
  async getStreamInfo(): Promise<any> {
    return this.redisStream.getStreamInfo('queue:tickets');
  }

  @Public()
  @Get('stream/groups')
  async getConsumerGroups(): Promise<any[]> {
    return this.redisStream.getConsumerGroups('queue:tickets');
  }

  @Public()
  @Post('clear-queue/:counterId')
  async clearQueue(@Param('counterId') counterId: string): Promise<any> {
    await this.redis.clearCounterQueue(counterId);
    return { ok: true, message: 'Queue cleared successfully' };
  }

  @Public()
  @Post('test-skip-logic/:counterId')
  async testSkipLogic(@Param('counterId') counterId: string): Promise<any> {
    
    // Get current queue status
    const queueStatus = await this.redis.getQueueStatusWithCleanup(counterId);
    
    // Perform skip
    const skipResult = await this.redis.skipCurrentPatientOptimized(counterId);
    
    // Get queue status after skip
    const queueStatusAfter = await this.redis.getQueueStatusWithCleanup(counterId);
    
    return {
      before: {
        queueLength: queueStatus.queue.length,
        queue: queueStatus.queue.slice(0, 5) // Show first 5 patients
      },
      skipResult,
      after: {
        queueLength: queueStatusAfter.queue.length,
        queue: queueStatusAfter.queue.slice(0, 5) // Show first 5 patients
      }
    };
  }
}

