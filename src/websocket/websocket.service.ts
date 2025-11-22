import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { QueueTicket } from '../cache/redis-stream.service';

export interface WebSocketMessage {
  type: 'NEW_TICKET' | 'TICKET_CALLED' | 'TICKET_COMPLETED' | 'COUNTER_STATUS' | 'NEXT_PATIENT_CALLED' | 'PATIENT_SKIPPED_AND_NEXT_CALLED' | 'PATIENT_PREPARING' | 'PATIENT_SERVED' | 'INVOICE_PAYMENT_SUCCESS' | 'NEW_PRESCRIPTION_PATIENT' | 'PATIENT_CALLED' | 'PATIENT_SKIPPED' | 'PATIENT_STATUS_CHANGED';
  data: any;
  timestamp: string;
}

@Injectable()
export class WebSocketService {
  private server: Server; // Default server (for backward compatibility)
  private boothServer: Server;
  // Store servers by namespace
  private namespaceServers: Map<string, Server> = new Map();
  private counterConnections: Map<string, Set<string>> = new Map(); // counterId -> Set<socketId>
  private socketToCounter: Map<string, string> = new Map(); // socketId -> counterId
  private cashierConnections: Map<string, Set<string>> = new Map(); // cashierId -> Set<socketId>
  private socketToCashier: Map<string, string> = new Map(); // socketId -> cashierId
  private postConnections: Map<string, Set<string>> = new Map(); // postId -> Set<socketId>
  private socketToPosts: Map<string, Set<string>> = new Map(); // socketId -> Set<postId>

  setServer(server: Server, namespace?: string) {
    this.server = server; // Keep for backward compatibility
    if (namespace) {
      this.namespaceServers.set(namespace, server);
      console.log(`[WebSocketService] Registered server for namespace: ${namespace}`);
    }
  }

  setBoothServer(server: Server) {
    this.boothServer = server;
    this.namespaceServers.set('/booths', server);
    console.log(`[WebSocketService] Registered server for namespace: /booths`);
  }

  /**
   * Get server for specific namespace
   */
  private getServerForNamespace(namespace: string): Server | null {
    const server = this.namespaceServers.get(namespace);
    if (server) {
      return server;
    }
    // Fallback to default server if namespace not found
    console.warn(`[WebSocketService] ⚠️ No server found for namespace ${namespace}, using default server`);
    return this.server;
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

    const connectionCount = this.cashierConnections.get(cashierId)!.size;
    console.log(`[CASHIER SOCKET] ✅ Socket ${socket.id} connected to cashier ${cashierId}`);
    console.log(`[CASHIER SOCKET] 📊 Cashier ${cashierId} now has ${connectionCount} active connection(s)`);
    console.log(`[CASHIER SOCKET] 🏠 Socket joined room: cashier:${cashierId}`);
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
        const remainingConnections = cashierSockets.size;
        console.log(`[CASHIER SOCKET] 🔌 Socket ${socket.id} disconnected from cashier ${cashierId}`);
        console.log(`[CASHIER SOCKET] 📊 Cashier ${cashierId} now has ${remainingConnections} remaining connection(s)`);
        if (cashierSockets.size === 0) {
          this.cashierConnections.delete(cashierId);
          console.log(`[CASHIER SOCKET] ⚠️ Cashier ${cashierId} is now OFFLINE (no active connections)`);
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

    // Sử dụng server của namespace /counters
    const namespace = '/counters';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[WebSocket] ❌ Cannot emit 'new_ticket': No server found for namespace ${namespace}`);
      return;
    }

    // Chỉ gửi đến counter tương ứng
    server.to(`counter:${counterId}`).emit('new_ticket', message);
    console.log(`🔔 [WebSocket] Emitted 'new_ticket' to room: counter:${counterId} on namespace ${namespace}`);

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

    // Sử dụng server của namespace /counters
    const namespace = '/counters';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[WebSocket] ❌ Cannot emit 'ticket_called': No server found for namespace ${namespace}`);
      return;
    }

    // Gửi đến tất cả counter
    server.emit('ticket_called', message);
    console.log(`🔔 [WebSocket] Emitted 'ticket_called' to all clients on namespace ${namespace}`);

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

    // Sử dụng server của namespace /counters
    const namespace = '/counters';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[WebSocket] ❌ Cannot emit 'ticket_completed': No server found for namespace ${namespace}`);
      return;
    }

    // Gửi đến tất cả counter
    server.emit('ticket_completed', message);

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
    
    // Sử dụng server của namespace /counters
    const namespace = '/counters';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[WebSocket] ❌ Cannot emit 'ticket_status': No server found for namespace ${namespace}`);
      return;
    }
    
    // Gửi đến tất cả để UI cập nhật danh sách
    server.emit('ticket_status', message);
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

    // Sử dụng server của namespace /counters
    const namespace = '/counters';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[WebSocket] ❌ Cannot emit 'counter_status': No server found for namespace ${namespace}`);
      return;
    }

    // Gửi đến tất cả counter
    server.emit('counter_status', message);
  }

  /**
   * Gửi thông báo đến tất cả counter
   */
  async broadcastToAllCounters(message: WebSocketMessage) {
    // Sử dụng server của namespace /counters
    const namespace = '/counters';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[WebSocket] ❌ Cannot emit 'broadcast': No server found for namespace ${namespace}`);
      return;
    }
    
    server.emit('broadcast', message);
  }

  /**
   * Gửi thông báo đến counter cụ thể
   */
  async sendToCounter(counterId: string, event: string, data: any) {
    console.log('🔔 [WebSocket] sendToCounter called');
    console.log('🔔 [WebSocket] Counter ID:', counterId);
    console.log('🔔 [WebSocket] Event:', event);
    console.log('🔔 [WebSocket] Data:', JSON.stringify(data, null, 2));
    
    // Sử dụng server của namespace /counters
    const namespace = '/counters';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[WebSocket] ❌ Cannot emit '${event}': No server found for namespace ${namespace}`);
      return;
    }
    
    server.to(`counter:${counterId}`).emit(event, data);
    console.log(`🔔 [WebSocket] Emitted '${event}' to room: counter:${counterId} on namespace ${namespace}`);
  }

  /**
   * Gửi thông báo đến cashier cụ thể
   */
  async sendToCashier(cashierId: string, event: string, data: any) {
    const namespace = '/counters';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[CASHIER SOCKET] ❌ Cannot emit '${event}': No server found for namespace ${namespace}`);
      return;
    }

    const connectionCount = this.getCashierConnectionCount(cashierId);
    const room = `cashier:${cashierId}`;
    
    console.log(`[CASHIER SOCKET] 📤 Broadcasting '${event}' to room '${room}' on namespace '${namespace}'`);
    console.log(`[CASHIER SOCKET] 📊 Cashier ${cashierId} has ${connectionCount} active connection(s)`);
    console.log(`[CASHIER SOCKET] 📦 Event data:`, JSON.stringify(data, null, 2));
    
    server.to(room).emit(event, data);
    
    console.log(`[CASHIER SOCKET] ✅ Event '${event}' sent to cashier ${cashierId}`);
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
    const isOnline = sockets ? sockets.size > 0 : false;
    const connectionCount = sockets ? sockets.size : 0;
    
    console.log(`[CASHIER SOCKET] 🔍 Checking cashier ${cashierId} online status: ${isOnline ? 'ONLINE' : 'OFFLINE'} (${connectionCount} connection(s))`);
    
    if (!isOnline) {
      const allOnlineCashiers = this.getOnlineCashiers();
      console.log(`[CASHIER SOCKET] 📋 Currently online cashiers:`, allOnlineCashiers);
    }
    
    return isOnline;
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
      console.log(`[CASHIER SOCKET] 🎯 Preparing to send invoice payment success notification`);
      console.log(`[CASHIER SOCKET] 💼 Target cashier: ${cashierId}`);
      console.log(`[CASHIER SOCKET] 🧾 Invoice code: ${invoiceData.invoiceCode}`);
      
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
      console.log(`[CASHIER SOCKET] ✅ Successfully sent invoice payment success notification to cashier ${cashierId}: ${invoiceData.invoiceCode}`);
    } catch (error) {
      console.error(`[CASHIER SOCKET] ❌ Error sending invoice payment success notification to cashier ${cashierId}:`, error);
    }
  }

  // ==================== PRESCRIPTION SYSTEM EVENTS ====================

  /**
   * Thông báo bệnh nhân mới đến với prescription
   */
  async notifyNewPrescriptionPatient(patientData: {
    patientProfileId: string;
    patientName: string;
    prescriptionCode: string;
    services: any[];
    doctorId?: string;
    technicianId?: string;
    serviceIds: string[];
    clinicRoomIds: string[];
    boothIds: string[];
  }): Promise<void> {
    try {
      const message: WebSocketMessage = {
        type: 'NEW_PRESCRIPTION_PATIENT',
        data: {
          patientProfileId: patientData.patientProfileId,
          patientName: patientData.patientName,
          prescriptionCode: patientData.prescriptionCode,
          services: patientData.services,
          doctorId: patientData.doctorId,
          technicianId: patientData.technicianId,
          serviceIds: patientData.serviceIds,
          clinicRoomIds: patientData.clinicRoomIds,
          boothIds: patientData.boothIds,
        },
        timestamp: new Date().toISOString(),
      };

      // Gửi đến các bác sĩ/kỹ thuật viên thực hiện dịch vụ
      if (patientData.doctorId) {
        await this.sendToDoctor(patientData.doctorId, 'new_prescription_patient', message);
      }
      if (patientData.technicianId) {
        await this.sendToTechnician(patientData.technicianId, 'new_prescription_patient', message);
      }

      // Gửi đến các buồng thực hiện dịch vụ
      for (const boothId of patientData.boothIds) {
        await this.sendToBooth(boothId, 'new_prescription_patient', message);
      }

      // Gửi đến các phòng thực hiện dịch vụ
      for (const clinicRoomId of patientData.clinicRoomIds) {
        await this.sendToClinicRoom(clinicRoomId, 'new_prescription_patient', message);
      }

      console.log(`[WebSocket] Sent new prescription patient notification: ${patientData.patientName} (${patientData.prescriptionCode})`);
    } catch (error) {
      console.error('Error sending new prescription patient notification:', error);
    }
  }

  /**
   * Thông báo bệnh nhân được gọi
   */
  async notifyPatientCalled(actionData: {
    patientProfileId: string;
    patientName: string;
    prescriptionCode: string;
    doctorId?: string;
    technicianId?: string;
    serviceIds: string[];
    clinicRoomIds: string[];
    boothIds: string[];
    action: 'CALLED' | 'SKIPPED';
    currentPatient?: any;
    nextPatient?: any;
    preparingPatient?: any;
  }): Promise<void> {
    try {
      const message: WebSocketMessage = {
        type: actionData.action === 'CALLED' ? 'PATIENT_CALLED' : 'PATIENT_SKIPPED',
        data: {
          patientProfileId: actionData.patientProfileId,
          patientName: actionData.patientName,
          prescriptionCode: actionData.prescriptionCode,
          doctorId: actionData.doctorId,
          technicianId: actionData.technicianId,
          serviceIds: actionData.serviceIds,
          clinicRoomIds: actionData.clinicRoomIds,
          boothIds: actionData.boothIds,
          action: actionData.action,
          currentPatient: actionData.currentPatient,
          nextPatient: actionData.nextPatient,
          preparingPatient: actionData.preparingPatient,
        },
        timestamp: new Date().toISOString(),
      };

      // Gửi đến các bác sĩ/kỹ thuật viên thực hiện dịch vụ
      if (actionData.doctorId) {
        await this.sendToDoctor(actionData.doctorId, 'patient_action', message);
      }
      if (actionData.technicianId) {
        await this.sendToTechnician(actionData.technicianId, 'patient_action', message);
      }

      // Gửi đến các buồng thực hiện dịch vụ
      for (const boothId of actionData.boothIds) {
        await this.sendToBooth(boothId, 'patient_action', message);
      }

      // Gửi đến các phòng thực hiện dịch vụ
      for (const clinicRoomId of actionData.clinicRoomIds) {
        await this.sendToClinicRoom(clinicRoomId, 'patient_action', message);
      }

      console.log(`[WebSocket] Sent patient ${actionData.action.toLowerCase()} notification: ${actionData.patientName} (${actionData.prescriptionCode})`);
    } catch (error) {
      console.error(`Error sending patient ${actionData.action.toLowerCase()} notification:`, error);
    }
  }

  /**
   * Thông báo thay đổi trạng thái bệnh nhân
   */
  async notifyPatientStatusChanged(statusData: {
    patientProfileId: string;
    patientName: string;
    prescriptionCode: string;
    oldStatus: string;
    newStatus: string;
    doctorId?: string;
    technicianId?: string;
    serviceIds: string[];
    clinicRoomIds: string[];
    boothIds: string[];
  }): Promise<void> {
    try {
      const message: WebSocketMessage = {
        type: 'PATIENT_STATUS_CHANGED',
        data: {
          patientProfileId: statusData.patientProfileId,
          patientName: statusData.patientName,
          prescriptionCode: statusData.prescriptionCode,
          oldStatus: statusData.oldStatus,
          newStatus: statusData.newStatus,
          doctorId: statusData.doctorId,
          technicianId: statusData.technicianId,
          serviceIds: statusData.serviceIds,
          clinicRoomIds: statusData.clinicRoomIds,
          boothIds: statusData.boothIds,
        },
        timestamp: new Date().toISOString(),
      };

      // Gửi đến các bác sĩ/kỹ thuật viên thực hiện dịch vụ
      if (statusData.doctorId) {
        await this.sendToDoctor(statusData.doctorId, 'patient_status_changed', message);
      }
      if (statusData.technicianId) {
        await this.sendToTechnician(statusData.technicianId, 'patient_status_changed', message);
      }

      // Gửi đến các buồng thực hiện dịch vụ
      for (const boothId of statusData.boothIds) {
        await this.sendToBooth(boothId, 'patient_status_changed', message);
      }

      // Gửi đến các phòng thực hiện dịch vụ
      for (const clinicRoomId of statusData.clinicRoomIds) {
        await this.sendToClinicRoom(clinicRoomId, 'patient_status_changed', message);
      }

      console.log(`[WebSocket] Sent patient status changed notification: ${statusData.patientName} ${statusData.oldStatus} -> ${statusData.newStatus}`);
    } catch (error) {
      console.error('Error sending patient status changed notification:', error);
    }
  }

  // ==================== HELPER METHODS FOR PRESCRIPTION SYSTEM ====================

  /**
   * Gửi thông báo đến bác sĩ cụ thể
   */
  async sendToDoctor(doctorId: string, event: string, data: any) {
    const room = `doctor:${doctorId}`;
    const namespace = '/doctors';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[DOCTOR SOCKET] ❌ Cannot emit '${event}': No server found for namespace ${namespace}`);
      return;
    }
    
    console.log(`[DOCTOR SOCKET] 📤 Broadcasting '${event}' to room '${room}' on namespace '${namespace}'`);
    console.log(`[DOCTOR SOCKET] Event data:`, JSON.stringify(data, null, 2));
    server.to(room).emit(event, data);
  }

  /**
   * Gửi thông báo đến kỹ thuật viên cụ thể
   */
  async sendToTechnician(technicianId: string, event: string, data: any) {
    const namespace = '/technicians';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[TECHNICIAN SOCKET] ❌ Cannot emit '${event}': No server found for namespace ${namespace}`);
      return;
    }
    
    console.log(`[TECHNICIAN SOCKET] 📤 Broadcasting '${event}' to room 'technician:${technicianId}' on namespace '${namespace}'`);
    server.to(`technician:${technicianId}`).emit(event, data);
  }

  /**
   * Gửi thông báo đến buồng cụ thể
   */
  async sendToBooth(boothId: string, event: string, data: any) {
    const namespace = '/booths';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[BOOTH SOCKET] ❌ Cannot emit '${event}': No server found for namespace ${namespace}`);
      return;
    }
    
    console.log(`[BOOTH SOCKET] 📤 Broadcasting '${event}' to room 'booth:${boothId}' on namespace '${namespace}'`);
    server.to(`booth:${boothId}`).emit(event, data);
  }

  /**
   * Gửi thông báo đến phòng cụ thể
   */
  async sendToClinicRoom(clinicRoomId: string, event: string, data: any) {
    const namespace = '/clinic-rooms';
    const server = this.getServerForNamespace(namespace);
    
    if (!server) {
      console.error(`[CLINIC ROOM SOCKET] ❌ Cannot emit '${event}': No server found for namespace ${namespace}`);
      return;
    }
    
    console.log(`[CLINIC ROOM SOCKET] 📤 Broadcasting '${event}' to room 'clinic_room:${clinicRoomId}' on namespace '${namespace}'`);
    server.to(`clinic_room:${clinicRoomId}`).emit(event, data);
  }
}
