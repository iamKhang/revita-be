export class WorkSessionByDoctorDto {
  doctorId: string;
  doctorName: string;
  doctorCode: string;
  totalSessions: number;
  completedSessions: number;
  canceledSessions: number;
  inProgressSessions: number;
  pendingSessions: number;
  approvedSessions: number;
  completedPercent: number;
  canceledPercent: number;
  totalWorkHours: number;
}

export class WorkSessionByTechnicianDto {
  technicianId: string;
  technicianName: string;
  technicianCode: string;
  totalSessions: number;
  completedSessions: number;
  canceledSessions: number;
  inProgressSessions: number;
  pendingSessions: number;
  approvedSessions: number;
  completedPercent: number;
  canceledPercent: number;
  totalWorkHours: number;
}

export class WorkSessionStatsResponseDto {
  byDoctor: WorkSessionByDoctorDto[];
  byTechnician: WorkSessionByTechnicianDto[];
  summary: {
    totalSessions: number;
    completedSessions: number;
    canceledSessions: number;
    completedPercent: number;
    canceledPercent: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}
