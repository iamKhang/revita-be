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
  patientProfileCode: string;
  patientProfile?: {
    id: string;
    profileCode: string;
    name: string;
    age?: number;
    gender?: string;
    dateOfBirth?: string;
    phone?: string;
    isPregnant?: boolean;
    isDisabled?: boolean;
  };
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
