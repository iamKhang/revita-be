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
  namespace: '/technicians',
})
export class TechnicianWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly webSocketService: WebSocketService) {}

  afterInit(server: Server) {
    this.webSocketService.setServer(server);
    console.log('Technician WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Technician client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Technician client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_technician')
  handleJoinTechnician(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { technicianId: string },
  ) {
    if (!data.technicianId) {
      client.emit('error', { message: 'Technician ID is required' });
      return;
    }

    // Join technician-specific room
    client.join(`technician:${data.technicianId}`);
    // Join general technicians room
    client.join('technicians');

    client.emit('joined_technician', { 
      technicianId: data.technicianId,
      message: `Connected as technician ${data.technicianId}` 
    });

    console.log(`Technician ${data.technicianId} joined via socket ${client.id}`);
  }

  @SubscribeMessage('leave_technician')
  handleLeaveTechnician(@ConnectedSocket() client: Socket) {
    client.emit('left_technician', { message: 'Left technician room' });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('get_online_technicians')
  handleGetOnlineTechnicians(@ConnectedSocket() client: Socket) {
    // This would need to be implemented to track online technicians
    client.emit('online_technicians', { technicians: [] });
  }
}

