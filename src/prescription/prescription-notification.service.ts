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

    console.log(`📡 Prescription service update: ${data.prescriptionCode} - ${data.serviceName} - ${data.status}`);
    console.log(`📡 Related parties: Booth=${data.boothCode}, Room=${data.clinicRoomName}, Doctor=${data.doctorName}, Technician=${data.technicianName}`);
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
      const callNotification = this.createPatientCallNotification(data);
      console.log(`📢 Patient call notification: ${data.patientName} - ${data.status}`, callNotification.data.callMessage);

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
