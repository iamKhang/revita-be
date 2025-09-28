import {
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Public } from '../rbac/public.decorator';
import { CounterAssignmentService } from './counter-assignment.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('counter-assignment')
export class CounterAssignmentController {
  constructor(
    private readonly counterAssignmentService: CounterAssignmentService,
  ) {}

  @Public()
  @Post('next-patient/:counterId')
  async callNextPatient(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.callNextPatient(counterId);
  }

  @Public()
  @Post('skip-current/:counterId')
  async skipCurrentPatient(@Param('counterId') counterId: string) {
    return this.counterAssignmentService.skipCurrentPatient(counterId);
  }
}
