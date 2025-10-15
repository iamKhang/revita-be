export class AppointmentStatsDto {
  total: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  pending: number;
  confirmedPercent: number;
  completedPercent: number;
  cancelledPercent: number;
}

export class PatientStatsDto {
  newPatients: number;
  returningPatients: number;
  totalPatients: number;
  newPatientsPercent: number;
  returningPatientsPercent: number;
}

export class DoctorRatingStatsDto {
  averageRating: number;
  totalDoctors: number;
  activeDoctors: number;
  totalRatings: number; // Tổng số đánh giá
  ratingDistribution: {
    rating: number;
    count: number;
  }[];
}

export class QuickKpiResponseDto {
  appointmentStats: AppointmentStatsDto;
  patientStats: PatientStatsDto;
  doctorRatingStats: DoctorRatingStatsDto;
  period: {
    startDate: string;
    endDate: string;
  };
}
