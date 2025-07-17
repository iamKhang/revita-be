import { IsUUID, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class CreateMedicalRecordDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @IsObject()
  @IsNotEmpty()
  content: object;
}
