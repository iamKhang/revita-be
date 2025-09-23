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
  namespace: '/counters',
})
export class CounterWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly webSocketService: WebSocketService) {}

  afterInit(server: Server) {
    this.webSocketService.setServer(server);
    console.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.webSocketService.disconnect(client);
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_counter')
  handleJoinCounter(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { counterId: string },
  ) {
    if (!data.counterId) {
      client.emit('error', { message: 'Counter ID is required' });
      return;
    }

    this.webSocketService.connectToCounter(client, data.counterId);
    client.emit('joined_counter', { 
      counterId: data.counterId,
      message: `Connected to counter ${data.counterId}` 
    });
  }

  @SubscribeMessage('leave_counter')
  handleLeaveCounter(@ConnectedSocket() client: Socket) {
    this.webSocketService.disconnect(client);
    client.emit('left_counter', { message: 'Left counter' });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('get_online_counters')
  handleGetOnlineCounters(@ConnectedSocket() client: Socket) {
    const onlineCounters = this.webSocketService.getOnlineCounters();
    client.emit('online_counters', { counters: onlineCounters });
  }
}
