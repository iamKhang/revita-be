import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { QueueTicket } from '../cache/redis-stream.service';

export interface WebSocketMessage {
  type: 'NEW_TICKET' | 'TICKET_CALLED' | 'TICKET_COMPLETED' | 'COUNTER_STATUS' | 'NEXT_PATIENT_CALLED' | 'PATIENT_SKIPPED_AND_NEXT_CALLED' | 'PATIENT_PREPARING' | 'PATIENT_SERVED' | 'PRESCRIPTION_SERVICE_STATUS_UPDATE' | 'SERVICE_ASSIGNED_TO_BOOTH' | 'PATIENT_CALL_NOTIFICATION' | 'BOOTH_QUEUE_UPDATE';
  data: any;
  timestamp: string;
}

@Injectable()
export class WebSocketService {
  private server: Server;
  private boothServer: Server;
  private counterConnections: Map<string, Set<string>> = new Map(); // counterId -> Set<socketId>
  private socketToCounter: Map<string, string> = new Map(); // socketId -> counterId
  private boothConnections: Map<string, Set<string>> = new Map(); // boothId -> Set<socketId>
  private socketToBooth: Map<string, string> = new Map(); // socketId -> boothId

  setServer(server: Server) {
    this.server = server;
  }

  setBoothServer(server: Server) {
    this.boothServer = server;
  }

  /**
   * Kết nối socket với counter
   */
  connectToCounter(socket: Socket, counterId: string) {
    // Lưu mapping socket -> counter
    this.socketToCounter.set(socket.id, counterId);

    // Thêm socket vào danh sách counter
    if (!this.counterConnections.has(counterId)) {
      this.counterConnections.set(counterId, new Set());
    }
    this.counterConnections.get(counterId)!.add(socket.id);

    // Join room để dễ quản lý
    socket.join(`counter:${counterId}`);

    console.log(`Socket ${socket.id} connected to counter ${counterId}`);
  }

  /**
   * Ngắt kết nối socket
   */
  disconnect(socket: Socket) {
    const counterId = this.socketToCounter.get(socket.id);
    if (counterId) {
      const counterSockets = this.counterConnections.get(counterId);
      if (counterSockets) {
        counterSockets.delete(socket.id);
        if (counterSockets.size === 0) {
          this.counterConnections.delete(counterId);
        }
      }
      this.socketToCounter.delete(socket.id);
    }

    console.log(`Socket ${socket.id} disconnected`);
  }

  /**
   * Gửi thông báo ticket mới đến counter
   */
  async notifyNewTicket(counterId: string, ticket: QueueTicket) {
    const message: WebSocketMessage = {
      type: 'NEW_TICKET',
      data: {
        ticketId: ticket.ticketId,
        patientName: ticket.patientName,
        patientAge: ticket.patientAge,
        priorityScore: ticket.priorityScore,
        priorityLevel: ticket.priorityLevel,
        counterId: ticket.counterId,
        counterCode: ticket.counterCode,
        counterName: ticket.counterName,
        queueNumber: ticket.queueNumber,
        sequence: ticket.sequence,
        estimatedWaitTime: ticket.estimatedWaitTime,
        metadata: ticket.metadata,
      },
      timestamp: new Date().toISOString(),
    };

    console.log('🔔 [WebSocket] notifyNewTicket called');
    console.log('🔔 [WebSocket] Counter ID:', counterId);
    console.log('🔔 [WebSocket] Ticket:', ticket.queueNumber);
    console.log('🔔 [WebSocket] Message:', JSON.stringify(message, null, 2));

    // Gửi đến room của counter
    this.server.to(`counter:${counterId}`).emit('new_ticket', message);
    console.log(`🔔 [WebSocket] Emitted 'new_ticket' to room: counter:${counterId}`);

    // Gửi đến tất cả counter để cập nhật danh sách
    const broadcastMessage = {
      type: 'TICKET_ADDED',
      data: {
        counterId,
        counterCode: ticket.counterCode,
        queueNumber: ticket.queueNumber,
        priorityLevel: ticket.priorityLevel,
      },
      timestamp: new Date().toISOString(),
    };
    this.server.emit('ticket_added', broadcastMessage);
    console.log(`🔔 [WebSocket] Emitted 'ticket_added' to all clients`);

    console.log(`✅ [WebSocket] Notified counter ${counterId} about new ticket ${ticket.queueNumber}`);
  }

  /**
   * Gửi thông báo ticket được gọi
   */
  async notifyTicketCalled(counterId: string, ticket: any) {
    const message: WebSocketMessage = {
      type: 'TICKET_CALLED',
      data: {
        ticketId: ticket.ticketId,
        queueNumber: ticket.queueNumber,
        patientName: ticket.patientName,
        counterId,
      },
      timestamp: new Date().toISOString(),
    };

    console.log('🔔 [WebSocket] notifyTicketCalled called');
    console.log('🔔 [WebSocket] Counter ID:', counterId);
    console.log('🔔 [WebSocket] Ticket:', ticket.queueNumber);
    console.log('🔔 [WebSocket] Message:', JSON.stringify(message, null, 2));

    // Gửi đến tất cả counter
    this.server.emit('ticket_called', message);
    console.log(`🔔 [WebSocket] Emitted 'ticket_called' to all clients`);

    console.log(`✅ [WebSocket] Notified all counters about ticket ${ticket.queueNumber} called at counter ${counterId}`);
  }

  /**
   * Gửi thông báo ticket hoàn thành
   */
  async notifyTicketCompleted(counterId: string, ticket: any) {
    const message: WebSocketMessage = {
      type: 'TICKET_COMPLETED',
      data: {
        ticketId: ticket.ticketId,
        queueNumber: ticket.queueNumber,
        counterId,
      },
      timestamp: new Date().toISOString(),
    };

    // Gửi đến tất cả counter
    this.server.emit('ticket_completed', message);

    console.log(`Notified all counters about ticket ${ticket.queueNumber} completed at counter ${counterId}`);
  }

  /**
   * Phát sự kiện cập nhật trạng thái ticket
   */
  async notifyTicketStatus(counterId: string, ticket: any) {
    const message: WebSocketMessage = {
      type: 'COUNTER_STATUS',
      data: {
        counterId,
        ticketId: ticket.ticketId,
        queueNumber: ticket.queueNumber,
        status: ticket.status,
        callCount: ticket.callCount,
      },
      timestamp: new Date().toISOString(),
    };
    // Gửi đến tất cả để UI cập nhật danh sách
    this.server.emit('ticket_status', message);
  }

  /**
   * Gửi thông báo trạng thái counter
   */
  async notifyCounterStatus(counterId: string, status: any) {
    const message: WebSocketMessage = {
      type: 'COUNTER_STATUS',
      data: {
        counterId,
        ...status,
      },
      timestamp: new Date().toISOString(),
    };

    // Gửi đến tất cả counter
    this.server.emit('counter_status', message);
  }

  /**
   * Gửi thông báo đến tất cả counter
   */
  async broadcastToAllCounters(message: WebSocketMessage) {
    this.server.emit('broadcast', message);
  }

  /**
   * Gửi thông báo đến counter cụ thể
   */
  async sendToCounter(counterId: string, event: string, data: any) {
    console.log('🔔 [WebSocket] sendToCounter called');
    console.log('🔔 [WebSocket] Counter ID:', counterId);
    console.log('🔔 [WebSocket] Event:', event);
    console.log('🔔 [WebSocket] Data:', JSON.stringify(data, null, 2));
    
    this.server.to(`counter:${counterId}`).emit(event, data);
    console.log(`🔔 [WebSocket] Emitted '${event}' to room: counter:${counterId}`);
  }

  /**
   * Lấy danh sách counter đang online
   */
  getOnlineCounters(): string[] {
    return Array.from(this.counterConnections.keys());
  }

  /**
   * Kiểm tra counter có đang online không
   */
  isCounterOnline(counterId: string): boolean {
    const sockets = this.counterConnections.get(counterId);
    return sockets ? sockets.size > 0 : false;
  }

  /**
   * Lấy số lượng kết nối của counter
   */
  getCounterConnectionCount(counterId: string): number {
    const sockets = this.counterConnections.get(counterId);
    return sockets ? sockets.size : 0;
  }

  // ========== BOOTH CONNECTION METHODS ==========

  /**
   * Kết nối socket với booth
   */
  connectToBooth(socket: Socket, boothId: string) {
    // Lưu mapping socket -> booth
    this.socketToBooth.set(socket.id, boothId);

    // Thêm socket vào danh sách booth
    if (!this.boothConnections.has(boothId)) {
      this.boothConnections.set(boothId, new Set());
    }
    this.boothConnections.get(boothId)!.add(socket.id);

    // Join room để dễ quản lý
    socket.join(`booth:${boothId}`);

    console.log(`Socket ${socket.id} connected to booth ${boothId}`);
  }

  /**
   * Ngắt kết nối booth socket
   */
  disconnectBooth(socket: Socket) {
    const boothId = this.socketToBooth.get(socket.id);
    if (boothId) {
      const boothSockets = this.boothConnections.get(boothId);
      if (boothSockets) {
        boothSockets.delete(socket.id);
        if (boothSockets.size === 0) {
          this.boothConnections.delete(boothId);
        }
      }
      this.socketToBooth.delete(socket.id);
    }

    console.log(`Booth socket ${socket.id} disconnected`);
  }

  /**
   * Gửi thông báo trạng thái booth
   */
  async notifyBoothStatusUpdate(boothId: string, statusData: any) {
    if (!this.boothServer) return;

    const message = {
      type: 'BOOTH_STATUS_UPDATE',
      data: {
        boothId,
        ...statusData,
      },
      timestamp: new Date().toISOString(),
    };

    // Gửi đến room của booth
    this.boothServer.to(`booth:${boothId}`).emit('booth_status_update', message);

    // Gửi đến tất cả booth để cập nhật danh sách
    this.boothServer.emit('booth_status_changed', message);

    console.log(`Notified booth ${boothId} about status update`);
  }

  /**
   * Gửi thông báo work session bắt đầu
   */
  async notifyWorkSessionStart(boothId: string, sessionData: any) {
    if (!this.boothServer) return;

    const message = {
      type: 'WORK_SESSION_START',
      data: {
        boothId,
        ...sessionData,
      },
      timestamp: new Date().toISOString(),
    };

    // Gửi đến room của booth
    this.boothServer.to(`booth:${boothId}`).emit('work_session_start', message);

    // Gửi đến tất cả booth
    this.boothServer.emit('work_session_started', message);

    console.log(`Notified booth ${boothId} about work session start`);
  }

  /**
   * Gửi thông báo work session kết thúc
   */
  async notifyWorkSessionEnd(boothId: string, sessionData: any) {
    if (!this.boothServer) return;

    const message = {
      type: 'WORK_SESSION_END',
      data: {
        boothId,
        ...sessionData,
      },
      timestamp: new Date().toISOString(),
    };

    // Gửi đến room của booth
    this.boothServer.to(`booth:${boothId}`).emit('work_session_end', message);

    // Gửi đến tất cả booth
    this.boothServer.emit('work_session_ended', message);

    console.log(`Notified booth ${boothId} about work session end`);
  }

  /**
   * Gửi thông báo đến booth cụ thể
   */
  async sendToBooth(boothId: string, event: string, data: any) {
    if (!this.boothServer) return;
    this.boothServer.to(`booth:${boothId}`).emit(event, data);
  }

  /**
   * Lấy danh sách booth đang online
   */
  getOnlineBooths(): string[] {
    return Array.from(this.boothConnections.keys());
  }

  /**
   * Kiểm tra booth có đang online không
   */
  isBoothOnline(boothId: string): boolean {
    const sockets = this.boothConnections.get(boothId);
    return sockets ? sockets.size > 0 : false;
  }

  /**
   * Lấy số lượng kết nối của booth
   */
  getBoothConnectionCount(boothId: string): number {
    const sockets = this.boothConnections.get(boothId);
    return sockets ? sockets.size : 0;
  }

  // ========== DOCTOR CONNECTION METHODS ==========

  /**
   * Gửi thông báo đến doctor cụ thể
   */
  async sendToDoctor(doctorId: string, event: string, data: any) {
    if (!this.server) return;
    this.server.to(`doctor:${doctorId}`).emit(event, data);
  }

  /**
   * Gửi thông báo đến technician cụ thể
   */
  async sendToTechnician(technicianId: string, event: string, data: any) {
    if (!this.server) return;
    this.server.to(`technician:${technicianId}`).emit(event, data);
  }

  /**
   * Gửi thông báo đến clinic room cụ thể
   */
  async sendToClinicRoom(clinicRoomId: string, event: string, data: any) {
    if (!this.server) return;
    this.server.to(`clinic_room:${clinicRoomId}`).emit(event, data);
  }

  /**
   * Gửi thông báo đến tất cả doctor
   */
  async broadcastToAllDoctors(event: string, data: any) {
    if (!this.server) return;
    this.server.to('doctors').emit(event, data);
  }

  /**
   * Gửi thông báo đến tất cả technician
   */
  async broadcastToAllTechnicians(event: string, data: any) {
    if (!this.server) return;
    this.server.to('technicians').emit(event, data);
  }

  /**
   * Gửi thông báo đến tất cả clinic rooms
   */
  async broadcastToAllClinicRooms(event: string, data: any) {
    if (!this.server) return;
    this.server.to('clinic_rooms').emit(event, data);
  }
}

