import { Injectable } from '@nestjs/common';
import { RedisService } from '../cache/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { PriorityCalculatorService } from './priority-calculator.service';
import { WebSocketService } from '../websocket/websocket.service';
import { 
  PatientPriorityInfo, 
  BoothQueueItem, 
  QueueStatus,
  PriorityLevel 
} from './priority.interface';
import { PrescriptionStatus } from '@prisma/client';

@Injectable()
export class BoothQueueService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly priorityCalculator: PriorityCalculatorService,
    private readonly webSocketService: WebSocketService,
  ) {}

  /**
   * Thêm bệnh nhân vào queue của booth
   */
  async addToBoothQueue(
    prescriptionServiceCompositeKey: string, // Format: "prescriptionId-serviceId"
    boothId: string,
    queueStatus: QueueStatus = QueueStatus.WAITING,
  ): Promise<BoothQueueItem> {
    try {
      // Parse composite key
      const [prescriptionId, serviceId] = prescriptionServiceCompositeKey.split('-');
      
      // Lấy thông tin chi tiết từ database
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
          booth: {
            include: {
              room: true,
            },
          },
          clinicRoom: true,
          workSession: {
            include: {
              doctor: true,
              technician: true,
            },
          },
        },
      });

      if (!prescriptionService) {
        throw new Error(`PrescriptionService ${prescriptionServiceCompositeKey} not found`);
      }

      // Tạo thông tin ưu tiên
      const patientData = {
        id: prescriptionService.prescription.patientProfile.id,
        name: prescriptionService.prescription.patientProfile.name,
        dateOfBirth: prescriptionService.prescription.patientProfile.dateOfBirth,
        gender: prescriptionService.prescription.patientProfile.gender,
        isPregnant: prescriptionService.prescription.patientProfile.gender === 'FEMALE' && 
                   this.isPregnantAge(prescriptionService.prescription.patientProfile.dateOfBirth),
        pregnancyWeeks: this.calculatePregnancyWeeks(prescriptionService.prescription.patientProfile.dateOfBirth),
        isDisabled: false, // Cần thêm field này vào PatientProfile
        prescriptionId: prescriptionService.prescription.id,
        prescriptionCode: prescriptionService.prescription.prescriptionCode,
        serviceId: prescriptionService.service.id,
        serviceName: prescriptionService.service.name,
        boothId: prescriptionService.boothId || boothId,
        boothCode: prescriptionService.booth?.boothCode || '',
        clinicRoomId: prescriptionService.clinicRoomId || '',
        clinicRoomName: prescriptionService.clinicRoom?.roomName || '',
      };

      const priorityInfo = this.priorityCalculator.extractPriorityInfoFromPatient(patientData);
      const patientPriorityInfo = this.priorityCalculator.calculatePatientPriority({
        ...priorityInfo,
        queueStatus,
        queuePosition: 0, // Sẽ được cập nhật sau
        estimatedWaitTime: 0, // Sẽ được cập nhật sau
        joinedAt: new Date(),
        lastUpdatedAt: new Date(),
      });

      // Tạo queue item
      const queueItem: BoothQueueItem = {
        id: `booth-${boothId}-${prescriptionServiceCompositeKey}-${Date.now()}`,
        patientPriorityInfo,
        prescriptionServiceId: prescriptionServiceCompositeKey,
        workSessionId: prescriptionService.workSessionId || undefined,
        doctorId: prescriptionService.doctorId || undefined,
        technicianId: prescriptionService.technicianId || undefined,
        streamId: '',
        timestamp: new Date(),
      };

      // Lưu vào Redis Stream
      const streamId = await this.redis.xadd(
        `booth:${boothId}:queue`,
        '*',
        'data', JSON.stringify(queueItem),
        'status', queueStatus,
        'priority_score', patientPriorityInfo.priorityScore.toString(),
        'priority_level', patientPriorityInfo.priorityLevel,
        'patient_name', patientPriorityInfo.patientName,
        'service_name', patientPriorityInfo.serviceName,
      );

      queueItem.streamId = streamId;

      // Cập nhật lại queue position và estimated wait time
      await this.updateQueuePositions(boothId);

      // Gửi thông báo WebSocket
      await this.notifyQueueUpdate(boothId, 'PATIENT_ADDED_TO_QUEUE', queueItem);

      return queueItem;

    } catch (error) {
      console.error('Error adding to booth queue:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách queue của booth
   */
  async getBoothQueue(boothId: string): Promise<BoothQueueItem[]> {
    try {
      const streamData = await this.redis.xrange(`booth:${boothId}:queue`, '-', '+');
      
      const queueItems: BoothQueueItem[] = streamData.map(([streamId, fields]) => {
        const dataField = fields.find(f => f[0] === 'data');
        if (!dataField) return null;
        
        const queueItem: BoothQueueItem = JSON.parse(dataField[1]);
        queueItem.streamId = streamId;
        return queueItem;
      }).filter((item): item is BoothQueueItem => item !== null);

      // Sắp xếp theo ưu tiên
      return this.sortQueueByPriority(queueItems);

    } catch (error) {
      console.error('Error getting booth queue:', error);
      return [];
    }
  }

  /**
   * Cập nhật trạng thái của bệnh nhân trong queue
   */
  async updateQueueItemStatus(
    boothId: string,
    prescriptionServiceCompositeKey: string,
    newStatus: QueueStatus,
  ): Promise<BoothQueueItem | null> {
    try {
      const queueItems = await this.getBoothQueue(boothId);
      const queueItem = queueItems.find(item => item.prescriptionServiceId === prescriptionServiceCompositeKey);
      
      if (!queueItem) {
        console.warn(`Queue item not found for prescriptionServiceId: ${prescriptionServiceCompositeKey}`);
        return null;
      }

      // Cập nhật trạng thái
      queueItem.patientPriorityInfo.queueStatus = newStatus;
      queueItem.patientPriorityInfo.lastUpdatedAt = new Date();

      // Tính lại điểm ưu tiên nếu cần
      if (newStatus === QueueStatus.RETURN_AFTER_RESULT) {
        const updatedPriority = this.priorityCalculator.calculatePatientPriority({
          ...queueItem.patientPriorityInfo,
          queueStatus: newStatus,
        });
        queueItem.patientPriorityInfo = updatedPriority;
      }

      // Cập nhật trong Redis
      await this.redis.xadd(
        `booth:${boothId}:queue`,
        '*',
        'data', JSON.stringify(queueItem),
        'status', newStatus,
        'priority_score', queueItem.patientPriorityInfo.priorityScore.toString(),
        'priority_level', queueItem.patientPriorityInfo.priorityLevel,
        'patient_name', queueItem.patientPriorityInfo.patientName,
        'service_name', queueItem.patientPriorityInfo.serviceName,
      );

      // Cập nhật lại vị trí trong queue
      await this.updateQueuePositions(boothId);

      // Gửi thông báo WebSocket
      await this.notifyQueueUpdate(boothId, 'QUEUE_ITEM_STATUS_UPDATED', queueItem);

      return queueItem;

    } catch (error) {
      console.error('Error updating queue item status:', error);
      throw error;
    }
  }

  /**
   * Xóa bệnh nhân khỏi queue
   */
  async removeFromBoothQueue(
    boothId: string,
    prescriptionServiceCompositeKey: string,
  ): Promise<boolean> {
    try {
      const queueItems = await this.getBoothQueue(boothId);
      const queueItem = queueItems.find(item => item.prescriptionServiceId === prescriptionServiceCompositeKey);
      
      if (!queueItem) {
        console.warn(`Queue item not found for prescriptionServiceId: ${prescriptionServiceCompositeKey}`);
        return false;
      }

      // Xóa khỏi Redis Stream (không thể xóa trực tiếp, chỉ đánh dấu)
      await this.redis.xadd(
        `booth:${boothId}:queue`,
        '*',
        'data', JSON.stringify({ ...queueItem, removed: true }),
        'status', 'REMOVED',
        'removed_at', new Date().toISOString(),
      );

      // Cập nhật lại vị trí trong queue
      await this.updateQueuePositions(boothId);

      // Gửi thông báo WebSocket
      await this.notifyQueueUpdate(boothId, 'PATIENT_REMOVED_FROM_QUEUE', queueItem);

      return true;

    } catch (error) {
      console.error('Error removing from booth queue:', error);
      throw error;
    }
  }

  /**
   * Cập nhật vị trí và thời gian chờ ước tính cho tất cả bệnh nhân trong queue
   */
  private async updateQueuePositions(boothId: string): Promise<void> {
    try {
      const queueItems = await this.getBoothQueue(boothId);
      const activeItems = queueItems.filter(item => !item.removed);

      // Sắp xếp lại theo ưu tiên
      const sortedItems = this.sortQueueByPriority(activeItems);

      // Cập nhật vị trí và thời gian chờ ước tính
      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        item.patientPriorityInfo.queuePosition = i + 1;
        item.patientPriorityInfo.estimatedWaitTime = this.priorityCalculator.calculateEstimatedWaitTime(i + 1);
        item.patientPriorityInfo.lastUpdatedAt = new Date();
      }

      // Lưu lại vào Redis
      for (const item of sortedItems) {
        await this.redis.xadd(
          `booth:${boothId}:queue`,
          '*',
          'data', JSON.stringify(item),
          'status', item.patientPriorityInfo.queueStatus,
          'priority_score', item.patientPriorityInfo.priorityScore.toString(),
          'priority_level', item.patientPriorityInfo.priorityLevel,
          'queue_position', item.patientPriorityInfo.queuePosition.toString(),
          'estimated_wait_time', item.patientPriorityInfo.estimatedWaitTime.toString(),
        );
      }

    } catch (error) {
      console.error('Error updating queue positions:', error);
    }
  }

  /**
   * Sắp xếp queue theo ưu tiên
   */
  private sortQueueByPriority(queueItems: BoothQueueItem[]): BoothQueueItem[] {
    return queueItems
      .filter(item => !item.removed)
      .sort((a, b) => this.priorityCalculator.comparePriority(
        a.patientPriorityInfo,
        b.patientPriorityInfo
      ));
  }

  /**
   * Gửi thông báo WebSocket về cập nhật queue
   */
  private async notifyQueueUpdate(
    boothId: string,
    eventType: string,
    queueItem: BoothQueueItem,
  ): Promise<void> {
    try {
      const queueItems = await this.getBoothQueue(boothId);
      
      console.log(`📡 Queue update: ${boothId} - ${eventType}`, {
        queueLength: queueItems.length,
        queueItem: queueItem.patientPriorityInfo.patientName,
      });

    } catch (error) {
      console.error('Error sending queue notification:', error);
    }
  }

  /**
   * Kiểm tra xem có phải phụ nữ trong độ tuổi sinh đẻ không
   */
  private isPregnantAge(dateOfBirth: Date | string): boolean {
    const age = this.priorityCalculator['calculateAge'](dateOfBirth);
    return age >= 15 && age <= 45;
  }

  /**
   * Tính số tuần thai (giả lập - cần thông tin thực tế từ bệnh nhân)
   */
  private calculatePregnancyWeeks(dateOfBirth: Date | string): number | undefined {
    // Đây là logic giả lập - trong thực tế cần thông tin từ bệnh nhân
    const age = this.priorityCalculator['calculateAge'](dateOfBirth);
    if (age >= 15 && age <= 45 && Math.random() > 0.7) { // 30% chance có thai
      return Math.floor(Math.random() * 40) + 1; // 1-40 tuần
    }
    return undefined;
  }

  /**
   * Lấy thống kê queue của booth
   */
  async getBoothQueueStats(boothId: string): Promise<{
    totalPatients: number;
    waitingPatients: number;
    preparingPatients: number;
    servingPatients: number;
    returnAfterResultPatients: number;
    averageWaitTime: number;
    priorityDistribution: Record<PriorityLevel, number>;
  }> {
    try {
      const queueItems = await this.getBoothQueue(boothId);
      const activeItems = queueItems.filter(item => !item.removed);

      const stats = {
        totalPatients: activeItems.length,
        waitingPatients: activeItems.filter(item => item.patientPriorityInfo.queueStatus === QueueStatus.WAITING).length,
        preparingPatients: activeItems.filter(item => item.patientPriorityInfo.queueStatus === QueueStatus.PREPARING).length,
        servingPatients: activeItems.filter(item => item.patientPriorityInfo.queueStatus === QueueStatus.SERVING).length,
        returnAfterResultPatients: activeItems.filter(item => item.patientPriorityInfo.queueStatus === QueueStatus.RETURN_AFTER_RESULT).length,
        averageWaitTime: activeItems.reduce((sum, item) => sum + item.patientPriorityInfo.estimatedWaitTime, 0) / activeItems.length || 0,
        priorityDistribution: {
          [PriorityLevel.VERY_HIGH]: activeItems.filter(item => item.patientPriorityInfo.priorityLevel === PriorityLevel.VERY_HIGH).length,
          [PriorityLevel.HIGH]: activeItems.filter(item => item.patientPriorityInfo.priorityLevel === PriorityLevel.HIGH).length,
          [PriorityLevel.NORMAL]: activeItems.filter(item => item.patientPriorityInfo.priorityLevel === PriorityLevel.NORMAL).length,
          [PriorityLevel.LOW]: activeItems.filter(item => item.patientPriorityInfo.priorityLevel === PriorityLevel.LOW).length,
        },
      };

      return stats;

    } catch (error) {
      console.error('Error getting booth queue stats:', error);
      return {
        totalPatients: 0,
        waitingPatients: 0,
        preparingPatients: 0,
        servingPatients: 0,
        returnAfterResultPatients: 0,
        averageWaitTime: 0,
        priorityDistribution: {
          [PriorityLevel.VERY_HIGH]: 0,
          [PriorityLevel.HIGH]: 0,
          [PriorityLevel.NORMAL]: 0,
          [PriorityLevel.LOW]: 0,
        },
      };
    }
  }
}
