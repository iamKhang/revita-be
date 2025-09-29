import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Public } from '../rbac/public.decorator';
import { CounterAssignmentService } from './counter-assignment.service';

export interface Counter {
  counterId: string;
  counterCode: string;
  counterName: string;
  location: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('counter-assignment')
export class CounterAssignmentController {
  constructor(
    private readonly counterAssignmentService: CounterAssignmentService,
  ) {}

  @Public()
  @Get('counters')
  async getCounters(): Promise<Counter[]> {
    return this.counterAssignmentService.getCounters();
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
  @Get('queue/:counterId')
  async getQueueSnapshot(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.getQueueSnapshot(counterId);
  }
}
