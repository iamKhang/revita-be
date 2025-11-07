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

  // Track rooms that each client has joined
  private clientRooms = new Map<string, Set<string>>();

  constructor(private readonly webSocketService: WebSocketService) {}

  afterInit(server: Server) {
    this.webSocketService.setServer(server, '/doctors');
    console.log('Doctor WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`[DOCTOR SOCKET] Client connected: ${client.id}`);
    console.log(`[DOCTOR SOCKET] Client IP: ${client.handshake.address}`);
    console.log(`[DOCTOR SOCKET] Client headers:`, client.handshake.headers);
    // Initialize rooms set for this client
    this.clientRooms.set(client.id, new Set());
  }

  handleDisconnect(client: Socket) {
    const rooms = this.clientRooms.get(client.id);
    console.log(`[DOCTOR SOCKET] ❌ Client disconnected: ${client.id}`);
    if (rooms && rooms.size > 0) {
      console.log(`[DOCTOR SOCKET] Leaving ${rooms.size} room(s):`, Array.from(rooms));
    }
    // Leave all rooms when client disconnects
    if (rooms) {
      rooms.forEach(room => {
        client.leave(room);
      });
      this.clientRooms.delete(client.id);
    }
  }

  @SubscribeMessage('join_doctor')
  handleJoinDoctor(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { doctorId: string },
  ) {
    console.log(`[DOCTOR SOCKET] 📥 Received 'join_doctor' from client ${client.id}:`, data);
    
    if (!data.doctorId || typeof data.doctorId !== 'string' || data.doctorId.trim() === '') {
      const errorResponse = { message: 'Valid Doctor ID is required' };
      console.log(`[DOCTOR SOCKET] ❌ Error for client ${client.id}:`, errorResponse);
      console.log(`[DOCTOR SOCKET] 📤 Emitting 'error' to client ${client.id}:`, errorResponse);
      client.emit('error', errorResponse);
      return;
    }

    const doctorId = data.doctorId.trim();
    const doctorRoom = `doctor:${doctorId}`;
    const generalRoom = 'doctors';

    // Get or create rooms set for this client
    const rooms = this.clientRooms.get(client.id) || new Set();

    // Join doctor-specific room
    if (!rooms.has(doctorRoom)) {
      client.join(doctorRoom);
      rooms.add(doctorRoom);
    }

    // Join general doctors room
    if (!rooms.has(generalRoom)) {
      client.join(generalRoom);
      rooms.add(generalRoom);
    }

    // Update client rooms tracking
    this.clientRooms.set(client.id, rooms);

    const joinResponse = { 
      doctorId: doctorId,
      message: `Connected as doctor ${doctorId}` 
    };

    console.log(`[DOCTOR SOCKET] ✅ Doctor ${doctorId} joined via socket ${client.id}`);
    console.log(`[DOCTOR SOCKET] Joined rooms: doctor:${doctorId}, doctors`);
    console.log(`[DOCTOR SOCKET] Total rooms for client ${client.id}:`, Array.from(rooms));
    console.log(`[DOCTOR SOCKET] 📤 Emitting 'joined_doctor' to client ${client.id}:`, joinResponse);
    
    client.emit('joined_doctor', joinResponse);
  }

  @SubscribeMessage('leave_doctor')
  handleLeaveDoctor(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { doctorId?: string },
  ) {
    console.log(`[DOCTOR SOCKET] 📥 Received 'leave_doctor' from client ${client.id}:`, data || 'no data');
    const rooms = this.clientRooms.get(client.id);
    
    if (data?.doctorId) {
      // Leave specific doctor room
      const doctorRoom = `doctor:${data.doctorId}`;
      if (rooms?.has(doctorRoom)) {
        client.leave(doctorRoom);
        rooms.delete(doctorRoom);
        const leaveResponse = { 
          doctorId: data.doctorId,
          message: `Left doctor room ${data.doctorId}` 
        };
        console.log(`[DOCTOR SOCKET] 📤 Emitting 'left_doctor' to client ${client.id}:`, leaveResponse);
        client.emit('left_doctor', leaveResponse);
      }
    } else {
      // Leave all doctor-related rooms
      if (rooms) {
        const doctorRooms = Array.from(rooms).filter(room => room.startsWith('doctor:'));
        doctorRooms.forEach(room => {
          client.leave(room);
          rooms.delete(room);
        });
        // Keep general 'doctors' room if exists
        if (rooms.has('doctors')) {
          rooms.delete('doctors');
          client.leave('doctors');
        }
        const leaveResponse = { message: 'Left all doctor rooms' };
        console.log(`[DOCTOR SOCKET] 📤 Emitting 'left_doctor' to client ${client.id}:`, leaveResponse);
        client.emit('left_doctor', leaveResponse);
      }
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    const pongResponse = { timestamp: new Date().toISOString() };
    console.log(`[DOCTOR SOCKET] 📥 Received 'ping' from client ${client.id}`);
    console.log(`[DOCTOR SOCKET] 📤 Emitting 'pong' to client ${client.id}:`, pongResponse);
    client.emit('pong', pongResponse);
  }

  @SubscribeMessage('get_online_doctors')
  handleGetOnlineDoctors(@ConnectedSocket() client: Socket) {
    // This would need to be implemented to track online doctors
    const onlineDoctorsResponse = { doctors: [] };
    console.log(`[DOCTOR SOCKET] 📥 Received 'get_online_doctors' from client ${client.id}`);
    console.log(`[DOCTOR SOCKET] 📤 Emitting 'online_doctors' to client ${client.id}:`, onlineDoctorsResponse);
    client.emit('online_doctors', onlineDoctorsResponse);
  }
}

