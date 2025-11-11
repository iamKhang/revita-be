import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { WorkSessionStatus } from '@prisma/client';

export class GetWorkSessionsBySpecialtyDto {
  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  specialtyCode?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(WorkSessionStatus)
  status?: WorkSessionStatus;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  technicianId?: string;
}
