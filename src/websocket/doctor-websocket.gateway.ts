import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WebSocketService } from './websocket.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../login/jwt-auth.guard';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/doctors',
})
export class DoctorWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly webSocketService: WebSocketService) {}

  afterInit(server: Server) {
    this.webSocketService.setServer(server);
    console.log('Doctor WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Doctor client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Doctor client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_doctor')
  handleJoinDoctor(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { doctorId: string },
  ) {
    if (!data.doctorId) {
      client.emit('error', { message: 'Doctor ID is required' });
      return;
    }

    // Join doctor-specific room
    client.join(`doctor:${data.doctorId}`);
    // Join general doctors room
    client.join('doctors');

    client.emit('joined_doctor', { 
      doctorId: data.doctorId,
      message: `Connected as doctor ${data.doctorId}` 
    });

    console.log(`Doctor ${data.doctorId} joined via socket ${client.id}`);
  }

  @SubscribeMessage('leave_doctor')
  handleLeaveDoctor(@ConnectedSocket() client: Socket) {
    client.emit('left_doctor', { message: 'Left doctor room' });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('get_online_doctors')
  handleGetOnlineDoctors(@ConnectedSocket() client: Socket) {
    // This would need to be implemented to track online doctors
    client.emit('online_doctors', { doctors: [] });
  }
}

