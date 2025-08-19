import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export class AssignCounterDto {
  @IsString()
  @IsNotEmpty()
  appointmentId: string;

  @IsString()
  @IsNotEmpty()
  patientProfileId: string;

  @IsString()
  @IsNotEmpty()
  invoiceId: string;

  @IsString()
  @IsOptional()
  patientName?: string;

  @IsNumber()
  @IsOptional()
  patientAge?: number;

  @IsString()
  @IsOptional()
  patientGender?: string;

  @IsBoolean()
  @IsOptional()
  isPregnant?: boolean;

  @IsBoolean()
  @IsOptional()
  isEmergency?: boolean;

  @IsBoolean()
  @IsOptional()
  isElderly?: boolean; // >70 tuổi

  @IsBoolean()
  @IsOptional()
  isDisabled?: boolean;

  @IsBoolean()
  @IsOptional()
  isVIP?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specialNeeds?: string[];

  @IsString()
  @IsOptional()
  priorityLevel?: 'HIGH' | 'MEDIUM' | 'LOW';

  @IsString()
  @IsOptional()
  notes?: string;
}
