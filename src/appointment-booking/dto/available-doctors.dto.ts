export class AvailableDoctorDto {
  doctorId: string;
  doctorCode: string;
  doctorName: string;
  specialtyId: string;
  specialtyName: string;
  rating: number;
  workSessionStart: string;
  workSessionEnd: string;
  boothId?: string;
  boothName?: string;
  roomName?: string;
}

export class AvailableDoctorsResponseDto {
  specialtyId: string;
  specialtyName: string;
  date: string;
  doctors: AvailableDoctorDto[];
}

