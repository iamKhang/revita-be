export interface PendingServiceDto {
  serviceId: string;
  serviceName: string;
  status: 'PENDING' | 'RESCHEDULED';
  doctorId?: string | null;
  technicianId?: string | null;
  doctorName?: string | null;
  technicianName?: string | null;
  isDoctorNotWorking?: boolean; // true nếu bác sĩ được hẹn nhưng không có work session IN_PROGRESS
  isTechnicianNotWorking?: boolean; // true nếu kỹ thuật viên được hẹn nhưng không có work session IN_PROGRESS
}

export interface PendingServicesResponseDto {
  prescriptionId: string;
  prescriptionCode: string;
  services: PendingServiceDto[];
  status: 'PENDING' | 'RESCHEDULED' | 'MIXED'; // MIXED nếu có cả PENDING và RESCHEDULED
  totalCount: number;
}
