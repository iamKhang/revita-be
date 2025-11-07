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
    this.webSocketService.setServer(server, '/counters');
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

  @SubscribeMessage('join_cashier')
  handleJoinCashier(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cashierId: string },
  ) {
    if (!data.cashierId) {
      client.emit('error', { message: 'Cashier ID is required' });
      return;
    }
    console.log('join_cashier', data);

    this.webSocketService.connectToCashier(client, data.cashierId);
    client.emit('joined_cashier', { 
      cashierId: data.cashierId,
      message: `Connected to cashier ${data.cashierId}` 
    });
  }

  @SubscribeMessage('leave_cashier')
  handleLeaveCashier(@ConnectedSocket() client: Socket) {
    this.webSocketService.disconnect(client);
    client.emit('left_cashier', { message: 'Left cashier' });
  }

  @SubscribeMessage('join_post')
  handleJoinPost(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { postId: string },
  ) {
    if (!data?.postId) {
      client.emit('error', { message: 'Post ID is required' });
      return;
    }

    this.webSocketService.connectToPost(client, data.postId);
    client.emit('joined_post', {
      postId: data.postId,
      message: `Connected to post ${data.postId}`,
    });
  }

  @SubscribeMessage('leave_post')
  handleLeavePost(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { postId?: string },
  ) {
    const postId = data?.postId;
    if (postId) {
      this.webSocketService.disconnectFromPost(client, postId);
      client.emit('left_post', {
        postId,
        message: `Left post ${postId}`,
      });
    } else {
      this.webSocketService.disconnectFromPost(client);
      client.emit('left_post', { message: 'Left all posts' });
    }
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

  // ==================== PRESCRIPTION SYSTEM EVENTS ====================

  @SubscribeMessage('join_doctor')
  handleJoinDoctor(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { doctorId: string },
  ) {
    if (!data.doctorId) {
      client.emit('error', { message: 'Doctor ID is required' });
      return;
    }

    client.join(`doctor:${data.doctorId}`);
    client.emit('joined_doctor', { 
      doctorId: data.doctorId,
      message: `Connected to doctor ${data.doctorId}` 
    });
  }

  @SubscribeMessage('leave_doctor')
  handleLeaveDoctor(@ConnectedSocket() client: Socket) {
    // Socket.io sẽ tự động leave room khi disconnect
    client.emit('left_doctor', { message: 'Left doctor room' });
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

    client.join(`technician:${data.technicianId}`);
    client.emit('joined_technician', { 
      technicianId: data.technicianId,
      message: `Connected to technician ${data.technicianId}` 
    });
  }

  @SubscribeMessage('leave_technician')
  handleLeaveTechnician(@ConnectedSocket() client: Socket) {
    client.emit('left_technician', { message: 'Left technician room' });
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

    client.join(`booth:${data.boothId}`);
    client.emit('joined_booth', { 
      boothId: data.boothId,
      message: `Connected to booth ${data.boothId}` 
    });
  }

  @SubscribeMessage('leave_booth')
  handleLeaveBooth(@ConnectedSocket() client: Socket) {
    client.emit('left_booth', { message: 'Left booth room' });
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

    client.join(`clinic_room:${data.clinicRoomId}`);
    client.emit('joined_clinic_room', { 
      clinicRoomId: data.clinicRoomId,
      message: `Connected to clinic room ${data.clinicRoomId}` 
    });
  }

  @SubscribeMessage('leave_clinic_room')
  handleLeaveClinicRoom(@ConnectedSocket() client: Socket) {
    client.emit('left_clinic_room', { message: 'Left clinic room' });
  }
}
