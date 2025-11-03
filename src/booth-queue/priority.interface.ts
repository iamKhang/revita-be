export interface PatientPriorityInfo {
  // Thông tin cơ bản
  patientProfileId: string;
  patientName: string;
  age: number;
  gender: string;
  
  // Thông tin ưu tiên
  isPregnant: boolean;
  pregnancyWeeks?: number; // Số tuần thai (nếu có thai)
  isDisabled: boolean; // Người khuyết tật
  isElderly: boolean; // Người già (>= 65 tuổi)
  isChild: boolean; // Trẻ em (< 6 tuổi)
  
  // Điểm ưu tiên được tính toán
  priorityScore: number;
  priorityLevel: 'VERY_HIGH' | 'HIGH' | 'NORMAL' | 'LOW';
  
  // Thông tin dịch vụ
  prescriptionId: string;
  prescriptionCode: string;
  serviceId: string;
  serviceName: string;
  boothId: string;
  boothCode: string;
  clinicRoomId: string;
  clinicRoomName: string;
  
  // Trạng thái trong queue
  queueStatus: 'WAITING' | 'PREPARING' | 'SERVING' | 'MISSING' | 'RETURN_AFTER_RESULT';
  queuePosition: number;
  estimatedWaitTime: number; // Phút
  
  // Timestamps
  joinedAt: Date;
  lastUpdatedAt: Date;
  
  // Metadata
  metadata?: Record<string, any>;
}

export interface BoothQueueItem {
  id: string; // Unique ID cho queue item
  patientPriorityInfo: PatientPriorityInfo;
  prescriptionServiceId: string; // ID của PrescriptionService
  workSessionId?: string;
  doctorId?: string;
  technicianId?: string;
  
  // Redis Stream data
  streamId: string;
  timestamp: Date;
  removed?: boolean; // Đánh dấu đã bị xóa
}

export enum PriorityLevel {
  VERY_HIGH = 'VERY_HIGH',
  HIGH = 'HIGH', 
  NORMAL = 'NORMAL',
  LOW = 'LOW'
}

export enum QueueStatus {
  WAITING = 'WAITING',
  PREPARING = 'PREPARING', 
  SERVING = 'SERVING',
  MISSING = 'MISSING',
  RETURN_AFTER_RESULT = 'RETURN_AFTER_RESULT'
}

export interface PriorityCalculationRules {
  // Điểm cơ bản
  baseScore: number;
  
  // Điểm cho người già (>= 65 tuổi)
  elderlyScore: number;
  elderlyAgeMultiplier: number; // Nhân với tuổi
  
  // Điểm cho trẻ em (< 6 tuổi) 
  childScore: number;
  childAgeMultiplier: number; // Nhân với (6 - tuổi)
  
  // Điểm cho phụ nữ mang thai
  pregnantScore: number;
  pregnancyWeekMultiplier: number; // Nhân với số tuần thai
  
  // Điểm cho người khuyết tật
  disabledScore: number;
  
  // Điểm cho RETURN_AFTER_RESULT (luôn ở đầu queue)
  returnAfterResultScore: number;
}
