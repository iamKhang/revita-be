export interface QueueServiceDto {
  prescriptionId: string;
  serviceId: string;
  serviceName: string;
  order: number;
  status: 'WAITING' | 'PREPARING' | 'SERVING' | 'SKIPPED' | 'WAITING_RESULT' | 'RETURNING';
  note?: string;
  startedAt?: Date;
  completedAt?: Date;
  skipCount?: number;
}

export interface QueuePatientDto {
  patientProfileId: string;
  patientName: string;
  prescriptionCode: string;
  services: QueueServiceDto[];
  // Trạng thái tổng thể của bệnh nhân (lấy trạng thái quan trọng nhất)
  overallStatus: 'WAITING' | 'PREPARING' | 'SERVING' | 'SKIPPED' | 'WAITING_RESULT' | 'RETURNING';
  // Số thứ tự dựa trên thời gian tạo hoặc order nhỏ nhất
  queueOrder: number;
}

export interface QueueResponseDto {
  patients: QueuePatientDto[];
  totalCount: number;
}
