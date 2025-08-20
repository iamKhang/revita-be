import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Public } from '../rbac/public.decorator';
import {
  CounterAssignmentService,
  AssignedCounter,
  CounterStatus,
} from './counter-assignment.service';
import { AssignCounterDto } from './dto/assign-counter.dto';
import { ScanInvoiceDto } from './dto/scan-invoice.dto';
import { DirectAssignmentDto } from './dto/direct-assignment.dto';
import { SimpleAssignmentDto } from './dto/simple-assignment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('counter-assignment')
export class CounterAssignmentController {
  constructor(
    private readonly counterAssignmentService: CounterAssignmentService,
  ) {}

  @Public()
  @Post('assign')
  async assignPatientToCounter(@Body() body: AssignCounterDto): Promise<{
    success: true;
    assignment: AssignedCounter;
  }> {
    const assignment =
      await this.counterAssignmentService.assignPatientToCounter(body);
    return {
      success: true,
      assignment,
    };
  }

  @Public()
  @Get('counters/available')
  async getAvailableCounters(): Promise<{
    counters: CounterStatus[];
  }> {
    const counters = await this.counterAssignmentService.getAvailableCounters();
    return { counters };
  }

  @Public()
  @Get('counters/:counterId/queue')
  async getCounterQueue(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.getCounterQueue(counterId);
  }

  @Public()
  @Get('counters/status')
  async getAllCountersStatus(): Promise<{
    totalCounters: number;
    availableCounters: number;
    busyCounters: number;
    averageQueueLength: number;
    counters: CounterStatus[];
  }> {
    const counters = await this.counterAssignmentService.getAvailableCounters();
    const totalCounters = counters.length;
    const availableCounters = counters.filter((c) => c.isAvailable).length;
    const busyCounters = totalCounters - availableCounters;
    const averageQueueLength =
      counters.reduce((sum, c) => sum + c.currentQueueLength, 0) /
      totalCounters;

    return {
      totalCounters,
      availableCounters,
      busyCounters,
      averageQueueLength: Math.round(averageQueueLength * 100) / 100,
      counters,
    };
  }

  @Public()
  @Post('counters/:counterId/online')
  async setCounterOnline(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.setCounterOnline(counterId);
  }

  @Public()
  @Post('counters/:counterId/offline')
  async setCounterOffline(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.setCounterOffline(counterId);
  }

  @Public()
  @Delete('counters/:counterId/queue')
  async clearCounterQueue(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.clearCounterQueue(counterId);
  }

  @Public()
  @Post('scan-invoice')
  async scanInvoiceAndAssign(@Body() body: ScanInvoiceDto) {
    return this.counterAssignmentService.scanInvoiceAndAssign(body);
  }

  @Public()
  @Post('direct-assignment')
  async assignDirectPatient(@Body() body: DirectAssignmentDto) {
    return this.counterAssignmentService.assignDirectPatient(body);
  }

  @Public()
  @Post('simple-assignment')
  async assignSimplePatient(@Body() body: SimpleAssignmentDto) {
    return this.counterAssignmentService.assignSimplePatient(body);
  }

  @Public()
  @Post('next-patient/:counterId')
  async callNextPatient(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.callNextPatient(counterId);
  }
}
