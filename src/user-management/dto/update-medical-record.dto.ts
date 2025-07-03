import { IsString, IsOptional } from 'class-validator';

export class UpdateMedicalRecordDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  appointmentId?: string;
}
