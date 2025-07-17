import { IsObject, IsOptional } from 'class-validator';

export class UpdateMedicalRecordDto {
  @IsObject()
  @IsOptional()
  content?: object;
}
