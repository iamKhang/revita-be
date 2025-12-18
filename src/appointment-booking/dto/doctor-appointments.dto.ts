import { PatientAppointmentDto } from './patient-appointments.dto';

export class DoctorAppointmentsResponseDto {
  doctorId: string;
  doctorName: string;
  totalAppointments: number;
  appointments: PatientAppointmentDto[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    totalPages: number;
  };
}

