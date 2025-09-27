import { Injectable } from '@nestjs/common';
import { WebSocketService } from '../websocket/websocket.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrescriptionStatus } from '@prisma/client';

export interface PrescriptionStatusUpdateEvent {
  type: 'PRESCRIPTION_SERVICE_STATUS_UPDATE';
  data: {
    prescriptionId: string;
    prescriptionCode: string;
    serviceId: string;
    serviceName: string;
    status: PrescriptionStatus;
    boothId?: string;
    boothCode?: string;
    boothName?: string;
    clinicRoomId?: string;
    clinicRoomName?: string;
    doctorId?: string;
    doctorName?: string;
    technicianId?: string;
    technicianName?: string;
    workSessionId?: string;
    patientProfileId: string;
    patientName: string;
    timestamp: string;
  };
}

@Injectable()
export class PrescriptionNotificationService {
  constructor(
    private readonly webSocketService: WebSocketService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Gửi thông báo cập nhật status dịch vụ đến tất cả các bên liên quan
   */
  async notifyPrescriptionServiceStatusUpdate(
    prescriptionId: string,
    serviceId: string,
    newStatus: PrescriptionStatus,
  ) {
    try {
      // Lấy thông tin chi tiết về dịch vụ và các bên liên quan
      const prescriptionService = await this.prisma.prescriptionService.findUnique({
        where: {
          prescriptionId_serviceId: {
            prescriptionId,
            serviceId,
          },
        },
        include: {
          prescription: {
            include: {
              patientProfile: true,
            },
          },
          service: true,
          booth: true,
          clinicRoom: true,
          doctor: {
            include: { auth: true },
          },
          technician: {
            include: { auth: true },
          },
          workSession: {
            include: {
              doctor: {
                include: { auth: true },
              },
              technician: {
                include: { auth: true },
              },
            },
          },
        },
      });

      if (!prescriptionService) {
        console.error(`PrescriptionService not found: ${prescriptionId}-${serviceId}`);
        return;
      }

      // Tạo event data
      const eventData: PrescriptionStatusUpdateEvent = {
        type: 'PRESCRIPTION_SERVICE_STATUS_UPDATE',
        data: {
          prescriptionId: prescriptionService.prescription.id,
          prescriptionCode: prescriptionService.prescription.prescriptionCode,
          serviceId: prescriptionService.service.id,
          serviceName: prescriptionService.service.name,
          status: newStatus,
          boothId: prescriptionService.boothId || undefined,
          boothCode: prescriptionService.booth?.boothCode || undefined,
          boothName: prescriptionService.booth?.name || undefined,
          clinicRoomId: prescriptionService.clinicRoomId || undefined,
          clinicRoomName: prescriptionService.clinicRoom?.roomName || undefined,
          doctorId: prescriptionService.doctorId || prescriptionService.workSession?.doctorId || undefined,
          doctorName: prescriptionService.doctor?.auth.name || prescriptionService.workSession?.doctor?.auth.name || undefined,
          technicianId: prescriptionService.technicianId || prescriptionService.workSession?.technicianId || undefined,
          technicianName: prescriptionService.technician?.auth.name || prescriptionService.workSession?.technician?.auth.name || undefined,
          workSessionId: prescriptionService.workSessionId || undefined,
          patientProfileId: prescriptionService.prescription.patientProfileId,
          patientName: prescriptionService.prescription.patientProfile.name,
          timestamp: new Date().toISOString(),
        },
      };

      // Gửi thông báo đến các bên liên quan
      await this.sendNotificationsToRelevantParties(eventData);

    } catch (error) {
      console.error('Error sending prescription status notification:', error);
    }
  }

  /**
   * Gửi thông báo đến các bên liên quan
   */
  private async sendNotificationsToRelevantParties(event: PrescriptionStatusUpdateEvent) {
    const { data } = event;

    // 1. Gửi đến booth (nếu có)
    if (data.boothId) {
      await this.webSocketService.sendToBooth(data.boothId, 'prescription_service_update', event);
      console.log(`📡 Sent notification to booth ${data.boothCode}`);
    }

    // 2. Gửi đến clinic room (nếu có)
    if (data.clinicRoomId) {
      await this.webSocketService.sendToClinicRoom(data.clinicRoomId, 'prescription_service_update', event);
      console.log(`📡 Sent notification to clinic room ${data.clinicRoomName}`);
    }

    // 3. Gửi đến doctor (nếu có)
    if (data.doctorId) {
      await this.webSocketService.sendToDoctor(data.doctorId, 'prescription_service_update', event);
      console.log(`📡 Sent notification to doctor ${data.doctorName}`);
    }

    // 4. Gửi đến technician (nếu có)
    if (data.technicianId) {
      await this.webSocketService.sendToTechnician(data.technicianId, 'prescription_service_update', event);
      console.log(`📡 Sent notification to technician ${data.technicianName}`);
    }

    // 5. Gửi thông báo đến counter để gọi bệnh nhân
    await this.sendPatientCallNotification(event);

    console.log(`📡 Sent prescription service update: ${data.prescriptionCode} - ${data.serviceName} - ${data.status}`);
  }

  /**
   * Gửi thông báo khi dịch vụ được gán vào buồng
   */
  async notifyServiceAssignedToBooth(
    prescriptionId: string,
    serviceId: string,
    boothId: string,
    workSessionId?: string,
  ) {
    try {
      const prescriptionService = await this.prisma.prescriptionService.findUnique({
        where: {
          prescriptionId_serviceId: {
            prescriptionId,
            serviceId,
          },
        },
        include: {
          prescription: {
            include: {
              patientProfile: true,
            },
          },
          service: true,
          booth: true,
          clinicRoom: true,
        },
      });

      if (!prescriptionService) return;

      const event = {
        type: 'SERVICE_ASSIGNED_TO_BOOTH' as const,
        data: {
          prescriptionId,
          prescriptionCode: prescriptionService.prescription.prescriptionCode,
          serviceId,
          serviceName: prescriptionService.service.name,
          boothId,
          boothCode: prescriptionService.booth?.boothCode,
          boothName: prescriptionService.booth?.name,
          clinicRoomId: prescriptionService.clinicRoomId,
          clinicRoomName: prescriptionService.clinicRoom?.roomName,
          workSessionId,
          patientName: prescriptionService.prescription.patientProfile.name,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      // Gửi đến booth
      await this.webSocketService.sendToBooth(boothId, 'service_assigned', event);

      // Gửi broadcast
      await this.webSocketService.broadcastToAllCounters(event);

      console.log(`📡 Service assigned to booth: ${prescriptionService.service.name} -> ${prescriptionService.booth?.boothCode}`);

    } catch (error) {
      console.error('Error sending service assignment notification:', error);
    }
  }

  /**
   * Gửi thông báo gọi bệnh nhân đến counter
   */
  private async sendPatientCallNotification(event: PrescriptionStatusUpdateEvent) {
    const { data } = event;

    try {
      // Tạo thông báo gọi bệnh nhân dựa trên status
      const callNotification = this.createPatientCallNotification(data);

      // Gửi đến tất cả counter để hiển thị trên màn hình gọi bệnh nhân
      await this.webSocketService.broadcastToAllCounters(callNotification);

      // Nếu có buồng cụ thể, gửi thông báo chi tiết đến buồng đó
      if (data.boothId) {
        await this.webSocketService.sendToBooth(data.boothId, 'patient_call', callNotification);
      }

      console.log(`📢 Patient call notification sent: ${data.patientName} - ${data.status}`);

    } catch (error) {
      console.error('Error sending patient call notification:', error);
    }
  }

  /**
   * Tạo thông báo gọi bệnh nhân dựa trên status
   */
  private createPatientCallNotification(data: any) {
    let callMessage = '';
    let callType = 'INFO';
    let urgency = 'NORMAL';

    switch (data.status) {
      case 'PENDING':
        callMessage = `Bệnh nhân ${data.patientName} đang chờ dịch vụ ${data.serviceName}`;
        callType = 'WAITING';
        break;
      
      case 'WAITING':
        callMessage = `Gọi bệnh nhân ${data.patientName} đến ${data.boothCode || data.clinicRoomName} để thực hiện ${data.serviceName}`;
        callType = 'CALL_PATIENT';
        urgency = 'HIGH';
        break;
      
      case 'PREPARING':
        callMessage = `Bệnh nhân ${data.patientName} đang chuẩn bị thực hiện ${data.serviceName} tại ${data.boothCode || data.clinicRoomName}`;
        callType = 'PREPARING';
        break;
      
      case 'SERVING':
        callMessage = `Đang thực hiện ${data.serviceName} cho bệnh nhân ${data.patientName} tại ${data.boothCode || data.clinicRoomName}`;
        callType = 'IN_PROGRESS';
        break;
      
      case 'WAITING_RESULT':
        callMessage = `Chờ kết quả ${data.serviceName} của bệnh nhân ${data.patientName}`;
        callType = 'WAITING_RESULT';
        break;
      
      case 'COMPLETED':
        callMessage = `Hoàn thành ${data.serviceName} cho bệnh nhân ${data.patientName}`;
        callType = 'COMPLETED';
        break;
      
      case 'CANCELLED':
        callMessage = `Hủy dịch vụ ${data.serviceName} của bệnh nhân ${data.patientName}`;
        callType = 'CANCELLED';
        break;
      
      default:
        callMessage = `Cập nhật trạng thái ${data.serviceName} cho bệnh nhân ${data.patientName}`;
    }

    return {
      type: 'PATIENT_CALL_NOTIFICATION' as const,
      data: {
        prescriptionCode: data.prescriptionCode,
        serviceName: data.serviceName,
        patientName: data.patientName,
        status: data.status,
        boothCode: data.boothCode,
        clinicRoomName: data.clinicRoomName,
        doctorName: data.doctorName,
        technicianName: data.technicianName,
        callMessage,
        callType,
        urgency,
        timestamp: data.timestamp,
      },
      timestamp: data.timestamp,
    };
  }
}
