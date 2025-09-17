import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class BookAppointmentDto {
  @IsString()
  @IsNotEmpty()
  patientProfileId: string;

  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;
}
