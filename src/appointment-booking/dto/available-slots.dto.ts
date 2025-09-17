export class AvailableSlotDto {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reason?: string; // "busy", "not_enough_time", etc.
}

export class AvailableSlotsResponseDto {
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  date: string;
  workSessionStart: string;
  workSessionEnd: string;
  slots: AvailableSlotDto[];
}

