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
  @Get('counters')
  async getAllCounters(): Promise<{
    counters: any[];
  }> {
    const counters = await this.counterAssignmentService.getAllCounters();
    return { counters };
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
  @Get('counters/:counterId/current-patient')
  async getCurrentPatient(@Param('counterId') counterId: string) {
    const patient =
      await this.counterAssignmentService.getCurrentPatient(counterId);
    return {
      success: true,
      patient,
      hasPatient: patient !== null,
    };
  }

  @Public()
  @Get('counters/:counterId/queue-status')
  async getQueueStatus(@Param('counterId') counterId: string) {
    const status =
      await this.counterAssignmentService.getQueueStatus(counterId);
    return {
      success: true,

      status,
    };
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
  @Post('next-patient/:counterId')
  async callNextPatient(@Param('counterId') counterId: string) {
    console.log('\n=== NEXT PATIENT CALLED ===');
    
    const result = await this.counterAssignmentService.callNextPatient(counterId);
    
    // Lấy thông tin sau khi gọi để hiển thị kết quả
    const newQueueStatus = await this.counterAssignmentService.getQueueStatus(counterId);
    const newCurrentPatient = await this.counterAssignmentService.getCurrentPatient(counterId);
    
    console.log('1. BỆNH NHÂN HIỆN TẠI:', newCurrentPatient ? {
      ticketId: (newCurrentPatient as any).ticketId,
      status: (newCurrentPatient as any).status,
      priorityScore: (newCurrentPatient as any).priorityScore
    } : 'Không có');
    
    const newPreparingPatient = newQueueStatus.queue?.find((p: any) => p.status === 'PREPARING');
    console.log('2. BỆNH NHÂN CHUẨN BỊ:', newPreparingPatient ? {
      ticketId: newPreparingPatient.ticketId,
      status: newPreparingPatient.status,
      priorityScore: newPreparingPatient.priorityScore
    } : 'Không có');
    
    console.log('3. DANH SÁCH CHỜ:', newQueueStatus.queue?.map((p: any) => ({
      ticketId: p.ticketId,
      status: p.status,
      priorityScore: p.priorityScore
    })) || []);
    console.log('=====================================\n');
    
    return result;
  }

  @Public()
  @Post('rollback/:counterId')
  async rollbackPreviousPatient(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.rollbackPreviousPatient(counterId);
  }

  @Public()
  @Post('return-previous/:counterId')
  async returnPreviousPatient(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.returnPreviousPatient(counterId);
  }

  @Public()
  @Post('go-back-previous/:counterId')
  async goBackToPreviousPatient(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.goBackToPreviousPatient(counterId);
  }

  @Public()
  @Post('skip-current/:counterId')
  async skipCurrentPatient(@Param('counterId') counterId: string) {
    console.log('\n=== SKIP CURRENT PATIENT CALLED ===');
    
    const result = await this.counterAssignmentService.skipCurrentPatient(counterId);
    
    // Lấy thông tin sau khi skip để hiển thị kết quả
    const newQueueStatus = await this.counterAssignmentService.getQueueStatus(counterId);
    const newCurrentPatient = await this.counterAssignmentService.getCurrentPatient(counterId);
    
    console.log('1. BỆNH NHÂN HIỆN TẠI:', newCurrentPatient ? {
      ticketId: (newCurrentPatient as any).ticketId,
      status: (newCurrentPatient as any).status,
      priorityScore: (newCurrentPatient as any).priorityScore
    } : 'Không có');
    
    const newPreparingPatient = newQueueStatus.queue?.find((p: any) => p.status === 'PREPARING');
    console.log('2. BỆNH NHÂN CHUẨN BỊ:', newPreparingPatient ? {
      ticketId: newPreparingPatient.ticketId,
      status: newPreparingPatient.status,
      priorityScore: newPreparingPatient.priorityScore
    } : 'Không có');
    
    console.log('3. DANH SÁCH CHỜ:', newQueueStatus.queue?.map((p: any) => ({
      ticketId: p.ticketId,
      status: p.status,
      priorityScore: p.priorityScore
    })) || []);
    console.log('=====================================\n');
    
    return result;
  }

  @Public()
  @Post('recall-skipped/:counterId')
  async recallSkippedPatient(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.recallSkippedPatient(counterId);
  }

  @Public()
  @Post('return-current/:counterId')
  async returnCurrentPatientToQueue(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.returnCurrentPatientToQueue(counterId);
  }

  @Public()
  @Post('mark-served/:counterId')
  async markPatientServed(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.markPatientServed(counterId);
  }


  @Public()
  @Post('cleanup-queue/:counterId')
  async cleanupQueue(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.cleanupQueue(counterId);
  }

  @Public()
  @Get('debug-queue/:counterId')
  async debugQueue(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.debugQueue(counterId);
  }

  @Public()
  @Post('test-skip/:counterId')
  async testSkipLogic(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.testSkipLogic(counterId);
  }

  @Public()
  @Get('redis-health/:counterId')
  async checkRedisHealth(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.checkRedisHealth(counterId);
  }

  @Public()
  @Post('test-performance/:counterId')
  async testPerformance(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.testPerformance(counterId);
  }

  @Public()
  @Get('redis-benchmark')
  async redisBenchmark() {
    return this.counterAssignmentService.redisBenchmark();
  }

  @Public()
  @Post('counters/:counterId/assign-receptionist')
  async assignReceptionistToCounter(
    @Param('counterId') counterId: string,
    @Body() body: { receptionistId: string },
  ) {
    return this.counterAssignmentService.assignReceptionistToCounter(
      counterId,
      body.receptionistId,
    );
  }

  @Public()
  @Post('counters/:counterId/unassign-receptionist')
  async unassignReceptionistFromCounter(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.unassignReceptionistFromCounter(
      counterId,
    );
  }
}
