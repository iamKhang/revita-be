import { Body, Controller, Get, Post } from '@nestjs/common';
import { RoutingService, AssignRequest, AssignedRoom } from './routing.service';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post('assign')
  async assign(@Body() body: AssignRequest): Promise<{ assignments: AssignedRoom[] }> {
    const assignments = await this.routingService.assignPatientToRooms(body);
    return { assignments };
  }

  @Get('rooms')
  async rooms() {
    return this.routingService.listRooms();
  }
}


