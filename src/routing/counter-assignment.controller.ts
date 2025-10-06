import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { Public } from '../rbac/public.decorator';
import { CounterAssignmentService } from './counter-assignment.service';
import { AssignCounterDto } from './dto/assign-counter.dto';
import { CheckoutCounterDto } from './dto/checkout-counter.dto';

export interface Counter {
  counterId: string;
  counterCode: string;
  counterName: string;
  location: string;
  status: 'BUSY' | 'AVAILABLE';
  assignedReceptionist?: {
    id: string;
    name: string;
  };
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

  @Post('assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECEPTIONIST)
  async assignReceptionistToCounter(
    @Body() assignCounterDto: AssignCounterDto,
    @Req() req: any,
  ) {
    console.log('\n=== ASSIGN RECEPTIONIST TO COUNTER CALLED ===');
    console.log('Counter ID:', assignCounterDto.counterId);
    console.log('Notes:', assignCounterDto.notes);
    console.log('Auth ID (authId):', req.user.id);
    console.log('Role from token:', req.user.role);
    console.log('=====================================\n');

    // Lấy authId từ JWT token (chính là req.user.id)
    const authId = req.user.id;
    
    if (!authId) {
      return {
        success: false,
        message: 'User ID not found in token',
      };
    }

    return this.counterAssignmentService.assignReceptionistToCounter(
      assignCounterDto.counterId,
      authId,
      assignCounterDto.notes,
    );
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECEPTIONIST)
  async checkoutReceptionistFromCounter(
    @Body() checkoutCounterDto: CheckoutCounterDto,
    @Req() req: any,
  ) {
    console.log('\n=== CHECKOUT RECEPTIONIST FROM COUNTER CALLED ===');
    console.log('Counter ID:', checkoutCounterDto.counterId);
    console.log('Auth ID (authId):', req.user.id);
    console.log('Role from token:', req.user.role);
    console.log('=====================================\n');

    // Lấy authId từ JWT token (chính là req.user.id)
    const authId = req.user.id;
    
    if (!authId) {
      return {
        success: false,
        message: 'User ID not found in token',
      };
    }

    return this.counterAssignmentService.checkoutReceptionistFromCounter(
      checkoutCounterDto.counterId,
      authId,
    );
  }
}
