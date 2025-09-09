import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  RoutingService,
  AssignRequest,
  AssignedRoom,
  UpdateStatusRequest,
} from './routing.service';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post('assign')
  async assign(
    @Body() body: AssignRequest,
  ): Promise<{ assignments: AssignedRoom[] }> {
    const assignments = await this.routingService.assignPatientToRooms(body);
    return { assignments };
  }

  @Get('rooms')
  async rooms() {
    return this.routingService.listRooms();
  }

  @Get('debug/work-sessions')
  async debugWorkSessions() {
    return this.routingService.debugWorkSessions();
  }

  @Post('status/left-temporarily')
  async markLeftTemporarily(@Body() body: UpdateStatusRequest) {
    return this.routingService.updateStatusForPatientInRoom(
      body,
      'LEFT_TEMPORARILY',
    );
  }

  @Post('status/returned')
  async markReturned(@Body() body: UpdateStatusRequest) {
    return this.routingService.updateStatusForPatientInRoom(body, 'RETURNED');
  }

  @Post('status/serving')
  async markServing(@Body() body: UpdateStatusRequest) {
    return this.routingService.updateStatusForPatientInRoom(body, 'SERVING');
  }

  @Post('status/waiting-result')
  async markWaitingResult(@Body() body: UpdateStatusRequest) {
    return this.routingService.updateStatusForPatientInRoom(
      body,
      'WAITING_RESULT',
    );
  }

  @Post('status/completed')
  async markCompleted(@Body() body: UpdateStatusRequest) {
    return this.routingService.updateStatusForPatientInRoom(body, 'COMPLETED');
  }

  @Post('status/skipped')
  async markSkipped(@Body() body: UpdateStatusRequest) {
    return this.routingService.updateStatusForPatientInRoom(body, 'SKIPPED');
  }
}
