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
  namespace: '/clinic-rooms',
})
export class ClinicRoomWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly webSocketService: WebSocketService) {}

  afterInit(server: Server) {
    this.webSocketService.setServer(server);
    console.log('Clinic Room WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Clinic Room client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Clinic Room client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_clinic_room')
  handleJoinClinicRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { clinicRoomId: string },
  ) {
    if (!data.clinicRoomId) {
      client.emit('error', { message: 'Clinic Room ID is required' });
      return;
    }

    // Join clinic room-specific room
    client.join(`clinic_room:${data.clinicRoomId}`);
    // Join general clinic rooms room
    client.join('clinic_rooms');

    client.emit('joined_clinic_room', { 
      clinicRoomId: data.clinicRoomId,
      message: `Connected to clinic room ${data.clinicRoomId}` 
    });

    console.log(`Clinic Room ${data.clinicRoomId} joined via socket ${client.id}`);
  }

  @SubscribeMessage('leave_clinic_room')
  handleLeaveClinicRoom(@ConnectedSocket() client: Socket) {
    client.emit('left_clinic_room', { message: 'Left clinic room' });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('get_online_clinic_rooms')
  handleGetOnlineClinicRooms(@ConnectedSocket() client: Socket) {
    // This would need to be implemented to track online clinic rooms
    client.emit('online_clinic_rooms', { clinicRooms: [] });
  }
}

