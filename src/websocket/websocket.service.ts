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
  private server: Server;
  private counterConnections: Map<string, Set<string>> = new Map(); // counterId -> Set<socketId>
  private socketToCounter: Map<string, string> = new Map(); // socketId -> counterId
  private cashierConnections: Map<string, Set<string>> = new Map(); // cashierId -> Set<socketId>
  private socketToCashier: Map<string, string> = new Map(); // socketId -> cashierId

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
   * Gửi thông báo đến cashier cụ thể
   */
  async sendToCashier(cashierId: string, event: string, data: any) {
    this.server.to(`cashier:${cashierId}`).emit(event, data);
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
    this.server.to(`doctor:${doctorId}`).emit(event, data);
  }

  /**
   * Gửi thông báo đến kỹ thuật viên cụ thể
   */
  async sendToTechnician(technicianId: string, event: string, data: any) {
    this.server.to(`technician:${technicianId}`).emit(event, data);
  }

  /**
   * Gửi thông báo đến buồng cụ thể
   */
  async sendToBooth(boothId: string, event: string, data: any) {
    this.server.to(`booth:${boothId}`).emit(event, data);
  }

  /**
   * Gửi thông báo đến phòng cụ thể
   */
  async sendToClinicRoom(clinicRoomId: string, event: string, data: any) {
    this.server.to(`clinic_room:${clinicRoomId}`).emit(event, data);
  }
}
