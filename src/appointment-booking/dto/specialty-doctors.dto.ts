export class SpecialtyDoctorDto {
  doctorId: string;
  doctorCode: string;
  doctorName: string;
  rating: number;
  yearsExperience: number;
  description?: string;
}

export class SpecialtyDoctorsResponseDto {
  specialtyId: string;
  specialtyName: string;
  doctors: SpecialtyDoctorDto[];
}

