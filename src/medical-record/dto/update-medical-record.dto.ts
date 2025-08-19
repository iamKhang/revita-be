import { IsObject, IsOptional, IsEnum } from 'class-validator';
import { MedicalRecordStatus } from '@prisma/client';

export class UpdateMedicalRecordDto {
  @IsObject()
  @IsOptional()
  content?: object;

  @IsEnum(MedicalRecordStatus)
  @IsOptional()
  status?: MedicalRecordStatus;
}
