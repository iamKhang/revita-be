import { Module } from '@nestjs/common';
import { CounterWebSocketGateway } from './websocket.gateway';
import { BoothWebSocketGateway } from './booth-websocket.gateway';
import { DoctorWebSocketGateway } from './doctor-websocket.gateway';
import { TechnicianWebSocketGateway } from './technician-websocket.gateway';
import { ClinicRoomWebSocketGateway } from './clinic-room-websocket.gateway';
import { WebSocketService } from './websocket.service';

@Module({
  providers: [
    CounterWebSocketGateway, 
    BoothWebSocketGateway, 
    DoctorWebSocketGateway,
    TechnicianWebSocketGateway,
    ClinicRoomWebSocketGateway,
    WebSocketService
  ],
  exports: [WebSocketService],
})
export class WebSocketModule {}
