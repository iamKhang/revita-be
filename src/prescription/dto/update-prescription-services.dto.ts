import { IsString, IsOptional, IsEnum, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { PrescriptionStatus } from '@prisma/client';

export class UpdatePrescriptionServiceItemDto {
  @IsString()
  @IsNotEmpty()
  prescriptionServiceId: string;

  @IsEnum(PrescriptionStatus)
  @IsOptional()
  status?: PrescriptionStatus;

  @IsString()
  @IsOptional()
  doctorId?: string;

  @IsString()
  @IsOptional()
  technicianId?: string;
}

export class UpdatePrescriptionServicesDto {
  @IsEnum(PrescriptionStatus)
  @IsOptional()
  prescriptionStatus?: PrescriptionStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePrescriptionServiceItemDto)
  @IsOptional()
  services?: UpdatePrescriptionServiceItemDto[];
}
