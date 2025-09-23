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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('take-number')
export class TakeNumberController {
  constructor(
    private readonly takeNumberService: TakeNumberService,
    private readonly redisStream: RedisStreamService,
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
}

