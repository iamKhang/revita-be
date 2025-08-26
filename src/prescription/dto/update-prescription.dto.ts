import { IsArray, IsOptional, IsString, IsUUID, ArrayNotEmpty } from 'class-validator';

export class UpdatePrescriptionDto {
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  // Replace service list with this ordered array if provided
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  serviceIds?: string[];
}
