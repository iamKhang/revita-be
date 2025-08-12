import { IsUUID } from 'class-validator';
import { IsNotEmpty } from 'class-validator';
import { IsObject } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsEnum } from 'class-validator';
import { MedicalRecordStatus } from '@prisma/client';

export class CreateMedicalRecordDto {
  @IsUUID()
  @IsNotEmpty()
  patientProfileId: string;

  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @IsEnum(MedicalRecordStatus)
  @IsOptional()
  status?: MedicalRecordStatus;

  @IsObject()
  @IsNotEmpty()
  content: object;
}
