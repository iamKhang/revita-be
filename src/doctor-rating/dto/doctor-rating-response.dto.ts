export class DoctorRatingResponseDto {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorCode: string;
  medicalRecordId: string;
  medicalRecordCode: string;
  patientId: string;
  patientName: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export class DoctorRatingStatsDto {
  totalRatings: number;
  averageRating: number;
  ratingDistribution: {
    rating: number;
    count: number;
    percentage: number;
  }[];
  recentComments: {
    id: string;
    comment: string;
    rating: number;
    patientName: string;
    createdAt: string;
  }[];
}

export class DoctorRatingSummaryDto {
  doctorId: string;
  doctorName: string;
  doctorCode: string;
  totalRatings: number;
  averageRating: number;
  ratingCount: number;
}
