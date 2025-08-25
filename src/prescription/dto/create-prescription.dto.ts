import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePrescriptionDto {
  @IsString()
  prescriptionCode: string;

  @IsUUID()
  patientProfileId: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  serviceIds: string[];
}


