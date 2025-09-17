export class DoctorServiceDto {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  price?: number;
  timePerPatient?: number; // phút
  description?: string;
}

export class DoctorServicesResponseDto {
  doctorId: string;
  doctorName: string;
  date: string;
  services: DoctorServiceDto[];
}

