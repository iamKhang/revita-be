import { IsObject, IsOptional, IsEnum } from 'class-validator';
import { MedicalRecordStatus } from '@prisma/client';

export class UpdateMedicalRecordDto {
  @IsObject()
  @IsOptional()
  content?: object;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  @IsEnum(MedicalRecordStatus)
  @IsOptional()
  status?: MedicalRecordStatus;
}
