import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export class DirectAssignmentDto {
  @IsString()
  @IsNotEmpty()
  patientName: string;

  @IsNumber()
  @IsNotEmpty()
  patientAge: number;

  @IsString()
  @IsNotEmpty()
  patientGender: string;

  @IsString()
  @IsOptional()
  patientPhone?: string;

  @IsString()
  @IsOptional()
  patientAddress?: string;

  @IsString()
  @IsOptional()
  serviceName?: string;

  @IsNumber()
  @IsOptional()
  servicePrice?: number;

  @IsBoolean()
  @IsOptional()
  isPregnant?: boolean;

  @IsBoolean()
  @IsOptional()
  isEmergency?: boolean;

  @IsBoolean()
  @IsOptional()
  isElderly?: boolean;

  @IsBoolean()
  @IsOptional()
  isDisabled?: boolean;

  @IsBoolean()
  @IsOptional()
  isVIP?: boolean;

  @IsString()
  @IsOptional()
  priorityLevel?: 'HIGH' | 'MEDIUM' | 'LOW';

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  assignedBy?: string; // ID của receptionist thực hiện phân bổ
}
