import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { QueueTicket } from '../cache/redis-stream.service';

export interface WebSocketMessage {
  type: 'NEW_TICKET' | 'TICKET_CALLED' | 'TICKET_COMPLETED' | 'COUNTER_STATUS';
  data: any;
  timestamp: string;
}

@Injectable()
export class WebSocketService {
  private server: Server;
  private counterConnections: Map<string, Set<string>> = new Map(); // counterId -> Set<socketId>
  private socketToCounter: Map<string, string> = new Map(); // socketId -> counterId

  setServer(server: Server) {
    this.server = server;
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

    // Gửi đến room của counter
    this.server.to(`counter:${counterId}`).emit('new_ticket', message);

    // Gửi đến tất cả counter để cập nhật danh sách
    this.server.emit('ticket_added', {
      type: 'TICKET_ADDED',
      data: {
        counterId,
        counterCode: ticket.counterCode,
        queueNumber: ticket.queueNumber,
        priorityLevel: ticket.priorityLevel,
      },
      timestamp: new Date().toISOString(),
    });

    console.log(`Notified counter ${counterId} about new ticket ${ticket.queueNumber}`);
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

    // Gửi đến tất cả counter
    this.server.emit('ticket_called', message);

    console.log(`Notified all counters about ticket ${ticket.queueNumber} called at counter ${counterId}`);
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
    this.server.to(`counter:${counterId}`).emit(event, data);
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
}

