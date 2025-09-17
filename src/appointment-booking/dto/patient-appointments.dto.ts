export class PatientAppointmentServiceDto {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  price: number | null;
  timePerPatient: number;
}

export class PatientAppointmentDto {
  appointmentId: string;
  appointmentCode: string;
  doctorId: string;
  doctorName: string;
  specialtyId: string;
  specialtyName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  services: PatientAppointmentServiceDto[];
  createdAt: string;
}

export class PatientAppointmentsResponseDto {
  patientId: string;
  patientName: string;
  totalAppointments: number;
  appointments: PatientAppointmentDto[];
}
