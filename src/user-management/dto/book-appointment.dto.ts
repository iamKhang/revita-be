import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class BookAppointmentDto {
  @IsString()
  @IsNotEmpty()
  bookerId: string;

  @IsString()
  @IsNotEmpty()
  patientProfileId: string;

  @IsString()
  @IsNotEmpty()
  specialtyId: string;

  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsString()
  @IsNotEmpty()
  status: string;

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
