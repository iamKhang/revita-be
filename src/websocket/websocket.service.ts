import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { QueueTicket } from '../cache/redis-stream.service';

export interface WebSocketMessage {
  type: 'NEW_TICKET' | 'TICKET_CALLED' | 'TICKET_COMPLETED' | 'COUNTER_STATUS' | 'NEXT_PATIENT_CALLED' | 'PATIENT_SKIPPED_AND_NEXT_CALLED' | 'PATIENT_PREPARING' | 'PATIENT_SERVED' | 'INVOICE_PAYMENT_SUCCESS';
  data: any;
  timestamp: string;
}

@Injectable()
export class WebSocketService {
  private server: Server;
  private boothServer: Server;
  private counterConnections: Map<string, Set<string>> = new Map(); // counterId -> Set<socketId>
  private socketToCounter: Map<string, string> = new Map(); // socketId -> counterId
  private cashierConnections: Map<string, Set<string>> = new Map(); // cashierId -> Set<socketId>
  private socketToCashier: Map<string, string> = new Map(); // socketId -> cashierId
  private postConnections: Map<string, Set<string>> = new Map(); // postId -> Set<socketId>
  private socketToPosts: Map<string, Set<string>> = new Map(); // socketId -> Set<postId>

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
   * Kết nối socket với cashier
   */
  connectToCashier(socket: Socket, cashierId: string) {
    // Lưu mapping socket -> cashier
    this.socketToCashier.set(socket.id, cashierId);

    // Thêm socket vào danh sách cashier
    if (!this.cashierConnections.has(cashierId)) {
      this.cashierConnections.set(cashierId, new Set());
    }
    this.cashierConnections.get(cashierId)!.add(socket.id);

    // Join room để dễ quản lý
    socket.join(`cashier:${cashierId}`);

    console.log(`Socket ${socket.id} connected to cashier ${cashierId}`);
  }

  /**
   * Kết nối socket với bài viết
   */
  connectToPost(socket: Socket, postId: string) {
    if (!postId) {
      return;
    }

    if (!this.socketToPosts.has(socket.id)) {
      this.socketToPosts.set(socket.id, new Set());
    }
    this.socketToPosts.get(socket.id)!.add(postId);

    if (!this.postConnections.has(postId)) {
      this.postConnections.set(postId, new Set());
    }
    this.postConnections.get(postId)!.add(socket.id);

    socket.join(`post:${postId}`);

    console.log(`Socket ${socket.id} connected to post ${postId}`);
  }

  /**
   * Ngắt kết nối socket khỏi bài viết
   */
  disconnectFromPost(socket: Socket, postId?: string) {
    const joinedPosts = this.socketToPosts.get(socket.id);
    if (!joinedPosts || joinedPosts.size === 0) {
      return;
    }

    const targetPostIds = postId ? [postId] : Array.from(joinedPosts);

    targetPostIds.forEach((id) => {
      const sockets = this.postConnections.get(id);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          this.postConnections.delete(id);
        }
      }
      joinedPosts.delete(id);
      socket.leave(`post:${id}`);
      console.log(`Socket ${socket.id} disconnected from post ${id}`);
    });

    if (joinedPosts.size === 0) {
      this.socketToPosts.delete(socket.id);
    }
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

    const cashierId = this.socketToCashier.get(socket.id);
    if (cashierId) {
      const cashierSockets = this.cashierConnections.get(cashierId);
      if (cashierSockets) {
        cashierSockets.delete(socket.id);
        if (cashierSockets.size === 0) {
          this.cashierConnections.delete(cashierId);
        }
      }
      this.socketToCashier.delete(socket.id);
    }

    this.disconnectFromPost(socket);

    console.log(`Socket ${socket.id} disconnected`);
  }

  /**
   * Gửi thông báo ticket mới đến counter
   */
  async notifyNewTicket(counterId: string, ticket: QueueTicket) {
    const metadata = ticket.metadata || {};
    const isPregnant = Boolean(metadata.isPregnant);
    const isDisabled = Boolean(metadata.isDisabled);
    const isElderly = typeof ticket.patientAge === 'number' ? ticket.patientAge >= 75 : false;
    const isChild = typeof ticket.patientAge === 'number' ? ticket.patientAge < 6 : Boolean((metadata as any)?.isChild) || false;

    const message: WebSocketMessage = {
      type: 'NEW_TICKET',
      data: {
        ticketId: ticket.ticketId,
        patientName: ticket.patientName,
        patientAge: ticket.patientAge,
        counterId: ticket.counterId,
        counterCode: ticket.counterCode,
        counterName: ticket.counterName,
        queueNumber: ticket.queueNumber,
        sequence: ticket.sequence,
        isOnTime: ticket.isOnTime,
        isPregnant,
        isDisabled,
        isElderly,
        isChild,
        status: ticket.status,
        callCount: ticket.callCount,
        queuePriority: ticket.queuePriority,
        metadata,
      },
      timestamp: new Date().toISOString(),
    };

    // Chỉ gửi đến counter tương ứng
    this.server.to(`counter:${counterId}`).emit('new_ticket', message);
    console.log(`🔔 [WebSocket] Emitted 'new_ticket' to room: counter:${counterId}`);

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
   * Gửi thông báo đến cashier cụ thể
   */
  async sendToCashier(cashierId: string, event: string, data: any) {
    this.server.to(`cashier:${cashierId}`).emit(event, data);
  }

  /**
   * Gửi thông báo đến bài viết cụ thể
   */
  sendToPost(postId: string, event: string, data: any) {
    if (!this.server) {
      return;
    }
    this.server.to(`post:${postId}`).emit(event, data);
  }

  /**
   * Phát sự kiện khi có bình luận mới trên bài viết
   */
  notifyPostCommentCreated(postId: string, comment: any) {
    const payload = {
      type: 'POST_COMMENT_CREATED',
      postId,
      comment,
      timestamp: new Date().toISOString(),
    };
    this.sendToPost(postId, 'post_comment_created', payload);
  }

  /**
   * Phát sự kiện khi bình luận bị xóa
   */
  notifyPostCommentDeleted(postId: string, commentId: string) {
    const payload = {
      type: 'POST_COMMENT_DELETED',
      postId,
      commentId,
      timestamp: new Date().toISOString(),
    };
    this.sendToPost(postId, 'post_comment_deleted', payload);
  }

  /**
   * Phát sự kiện khi bài viết được like
   */
  notifyPostLiked(postId: string, data: { userId: string; likesCount: number }) {
    const payload = {
      type: 'POST_LIKED',
      postId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.sendToPost(postId, 'post_liked', payload);
  }

  /**
   * Phát sự kiện khi bài viết bị unlike
   */
  notifyPostUnliked(postId: string, data: { userId: string; likesCount: number }) {
    const payload = {
      type: 'POST_UNLIKED',
      postId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.sendToPost(postId, 'post_unliked', payload);
  }

  /**
   * Phát sự kiện khi bình luận được like
   */
  notifyPostCommentLiked(
    postId: string,
    commentId: string,
    data: { userId: string; likeCount: number },
  ) {
    const payload = {
      type: 'POST_COMMENT_LIKED',
      postId,
      commentId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.sendToPost(postId, 'post_comment_liked', payload);
  }

  /**
   * Phát sự kiện khi bình luận bị unlike
   */
  notifyPostCommentUnliked(
    postId: string,
    commentId: string,
    data: { userId: string; likeCount: number },
  ) {
    const payload = {
      type: 'POST_COMMENT_UNLIKED',
      postId,
      commentId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.sendToPost(postId, 'post_comment_unliked', payload);
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

  /**
   * Lấy danh sách cashier đang online
   */
  getOnlineCashiers(): string[] {
    return Array.from(this.cashierConnections.keys());
  }

  /**
   * Kiểm tra cashier có đang online không
   */
  isCashierOnline(cashierId: string): boolean {
    const sockets = this.cashierConnections.get(cashierId);
    return sockets ? sockets.size > 0 : false;
  }

  /**
   * Lấy số lượng kết nối của cashier
   */
  getCashierConnectionCount(cashierId: string): number {
    const sockets = this.cashierConnections.get(cashierId);
    return sockets ? sockets.size : 0;
  }

  /**
   * Gửi sự kiện thay đổi vị trí queue
   */
  async notifyQueuePositionChanges(
    counterId: string,
    eventType: 'NEXT_PATIENT' | 'SKIP_PATIENT' | 'NEW_TICKET',
    changes: {
      newPatients: any[];
      movedPatients: any[];
      removedPatients: any[];
      currentServing?: any;
      currentNext?: any;
    },
  ): Promise<void> {
    try {
      const eventData = {
        type: eventType,
        counterId,
        timestamp: new Date().toISOString(),
        changes: {
          newPatients: changes.newPatients,
          movedPatients: changes.movedPatients,
          removedPatients: changes.removedPatients,
          currentServing: changes.currentServing,
          currentNext: changes.currentNext,
        },
      };

      await this.sendToCounter(counterId, 'queue_position_changes', eventData);
      console.log(`[WebSocket] Sent queue position changes to counter ${counterId}:`, eventType);
    } catch (error) {
      console.error('Error sending queue position changes:', error);
    }
  }

  /**
   * Gửi sự kiện cập nhật trạng thái bệnh nhân
   */
  async notifyPatientStatusUpdate(
    counterId: string,
    patientId: string,
    oldStatus: string,
    newStatus: string,
    patientData: any,
  ): Promise<void> {
    try {
      const eventData = {
        type: 'PATIENT_STATUS_UPDATE',
        counterId,
        patientId,
        oldStatus,
        newStatus,
        patientData,
        timestamp: new Date().toISOString(),
      };

      await this.sendToCounter(counterId, 'patient_status_update', eventData);
      console.log(`[WebSocket] Sent patient status update to counter ${counterId}: ${patientId} ${oldStatus} -> ${newStatus}`);
    } catch (error) {
      console.error('Error sending patient status update:', error);
    }
  }

  /**
   * Gửi sự kiện cập nhật toàn bộ queue
   */
  async notifyQueueUpdate(
    counterId: string,
    queueData: any[],
    eventType: 'FULL_QUEUE_UPDATE' | 'QUEUE_REFRESH',
  ): Promise<void> {
    try {
      const eventData = {
        type: eventType,
        counterId,
        queue: queueData,
        timestamp: new Date().toISOString(),
      };

      await this.sendToCounter(counterId, 'queue_update', eventData);
      console.log(`[WebSocket] Sent queue update to counter ${counterId}: ${queueData.length} patients`);
    } catch (error) {
      console.error('Error sending queue update:', error);
    }
  }

  /**
   * Gửi thông báo hóa đơn thanh toán thành công đến cashier cụ thể
   */
  async notifyCashierInvoicePaymentSuccess(cashierId: string, invoiceData: any): Promise<void> {
    try {
      const message: WebSocketMessage = {
        type: 'INVOICE_PAYMENT_SUCCESS',
        data: {
          invoiceId: invoiceData.id,
          invoiceCode: invoiceData.invoiceCode,
          totalAmount: invoiceData.totalAmount,
          amountPaid: invoiceData.amountPaid,
          changeAmount: invoiceData.changeAmount,
          paymentMethod: invoiceData.paymentMethod,
          paymentStatus: invoiceData.paymentStatus,
          paidAt: invoiceData.paidAt || new Date(),
          patientProfile: invoiceData.patientProfile,
          invoiceDetails: invoiceData.invoiceDetails,
          cashierId: invoiceData.cashierId,
        },
        timestamp: new Date().toISOString(),
      };

      // Gửi đến cashier cụ thể
      await this.sendToCashier(cashierId, 'invoice_payment_success', message);
      console.log(`[WebSocket] Sent invoice payment success notification to cashier ${cashierId}: ${invoiceData.invoiceCode}`);
    } catch (error) {
      console.error('Error sending invoice payment success notification to cashier:', error);
    }
  }
}
