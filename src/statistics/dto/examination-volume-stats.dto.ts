export class ExaminationByDoctorDto {
  doctorId: string;
  doctorName: string;
  doctorCode: string;
  appointmentsPerDay: number;
  appointmentsPerWeek: number;
  appointmentsPerMonth: number;
  totalAppointments: number;
  completedAppointments: number;
  averageDurationMinutes: number;
}

export class ExaminationByTimeDto {
  date: string;
  totalAppointments: number;
  completedAppointments: number;
  averageDurationMinutes: number;
}

export class ExaminationVolumeStatsResponseDto {
  byDoctor: ExaminationByDoctorDto[];
  byTime: ExaminationByTimeDto[];
  summary: {
    totalAppointments: number;
    completedAppointments: number;
    averageDurationMinutes: number;
    appointmentsPerDay: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}
