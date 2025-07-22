import { IsUUID } from 'class-validator';
import { IsNotEmpty } from 'class-validator';
import { IsObject } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsEnum } from 'class-validator';
import { MedicalRecordStatus } from '@prisma/client';

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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  @IsEnum(MedicalRecordStatus)
  @IsOptional()
  status?: MedicalRecordStatus;

  @IsObject()
  @IsNotEmpty()
  content: object;
}
