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
  namespace: '/booths',
})
export class BoothWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly webSocketService: WebSocketService) {}

  afterInit(server: Server) {
    this.webSocketService.setBoothServer(server);
    console.log('Booth WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Booth client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Booth client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_booth')
  handleJoinBooth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { boothId: string },
  ) {
    if (!data.boothId) {
      client.emit('error', { message: 'Booth ID is required' });
      return;
    }

    client.emit('joined_booth', { 
      boothId: data.boothId,
      message: `Connected to booth ${data.boothId}` 
    });
  }

  @SubscribeMessage('leave_booth')
  handleLeaveBooth(@ConnectedSocket() client: Socket) {
    client.emit('left_booth', { message: 'Left booth' });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('get_online_booths')
  handleGetOnlineBooths(@ConnectedSocket() client: Socket) {
    client.emit('online_booths', { booths: [] });
  }

  @SubscribeMessage('booth_status_update')
  handleBoothStatusUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { boothId: string; status: string; workSessionId?: string }
  ) {
    if (!data.boothId || !data.status) {
      client.emit('error', { message: 'Booth ID and status are required' });
      return;
    }

    console.log(`Booth status update: ${data.boothId} - ${data.status}`);
  }

  @SubscribeMessage('work_session_start')
  handleWorkSessionStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { boothId: string; workSessionId: string; doctorId?: string; technicianId?: string }
  ) {
    if (!data.boothId || !data.workSessionId) {
      client.emit('error', { message: 'Booth ID and Work Session ID are required' });
      return;
    }

    console.log(`Work session start: ${data.boothId} - ${data.workSessionId}`);
  }

  @SubscribeMessage('work_session_end')
  handleWorkSessionEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { boothId: string; workSessionId: string }
  ) {
    if (!data.boothId || !data.workSessionId) {
      client.emit('error', { message: 'Booth ID and Work Session ID are required' });
      return;
    }

    console.log(`Work session end: ${data.boothId} - ${data.workSessionId}`);
  }
}

