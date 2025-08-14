import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsObject,
} from 'class-validator';

export class CreateMedicalRecordDto {
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsUUID()
  @IsOptional()
  patientProfileId?: string;

  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  @IsObject()
  @IsNotEmpty()
  content: object;

  @IsString()
  @IsOptional()
  appointmentId?: string;
}
