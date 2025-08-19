import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { CounterAssignmentService, AssignedCounter, CounterStatus } from './counter-assignment.service';
import { AssignCounterDto } from './dto/assign-counter.dto';
import { ScanInvoiceDto } from './dto/scan-invoice.dto';
import { DirectAssignmentDto } from './dto/direct-assignment.dto';
import { SimpleAssignmentDto } from './dto/simple-assignment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('counter-assignment')
export class CounterAssignmentController {
  constructor(private readonly counterAssignmentService: CounterAssignmentService) {}

  @Post('assign')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  async assignPatientToCounter(@Body() body: AssignCounterDto): Promise<{
    success: true;
    assignment: AssignedCounter;
  }> {
    const assignment = await this.counterAssignmentService.assignPatientToCounter(body);
    return {
      success: true,
      assignment,
    };
  }

  @Get('counters/available')
  @Roles(Role.RECEPTIONIST, Role.ADMIN, Role.DOCTOR)
  async getAvailableCounters(): Promise<{
    counters: CounterStatus[];
  }> {
    const counters = await this.counterAssignmentService.getAvailableCounters();
    return { counters };
  }

  @Get('counters/:counterId/queue')
  @Roles(Role.RECEPTIONIST, Role.ADMIN, Role.DOCTOR)
  async getCounterQueue(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.getCounterQueue(counterId);
  }

  @Get('counters/status')
  @Roles(Role.RECEPTIONIST, Role.ADMIN, Role.DOCTOR)
  async getAllCountersStatus(): Promise<{
    totalCounters: number;
    availableCounters: number;
    busyCounters: number;
    averageQueueLength: number;
    counters: CounterStatus[];
  }> {
    const counters = await this.counterAssignmentService.getAvailableCounters();
    const totalCounters = counters.length;
    const availableCounters = counters.filter(c => c.isAvailable).length;
    const busyCounters = totalCounters - availableCounters;
    const averageQueueLength = counters.reduce((sum, c) => sum + c.currentQueueLength, 0) / totalCounters;

    return {
      totalCounters,
      availableCounters,
      busyCounters,
      averageQueueLength: Math.round(averageQueueLength * 100) / 100,
      counters,
    };
  }

  @Post('scan-invoice')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  async scanInvoiceAndAssign(@Body() body: ScanInvoiceDto) {
    return this.counterAssignmentService.scanInvoiceAndAssign(body);
  }

  @Post('direct-assignment')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  async assignDirectPatient(@Body() body: DirectAssignmentDto) {
    return this.counterAssignmentService.assignDirectPatient(body);
  }

  @Post('simple-assignment')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  async assignSimplePatient(@Body() body: SimpleAssignmentDto) {
    return this.counterAssignmentService.assignSimplePatient(body);
  }
}
