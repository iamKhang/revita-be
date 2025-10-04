import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePrescriptionServiceItemDto {
  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  serviceCode?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreatePrescriptionDto {
  @IsOptional()
  prescriptionCode?: string;

  @IsString()
  patientProfileId: string;

  @IsOptional()
  @IsString()
  doctorId?: string; // Optional: will be extracted from JWT token if not provided

  @IsOptional()
  @IsString()
  medicalRecordId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  // medications removed from this DTO; moved to medication-prescription module

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionServiceItemDto)
  services: CreatePrescriptionServiceItemDto[];
}
