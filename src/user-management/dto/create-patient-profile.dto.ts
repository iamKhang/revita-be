import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsObject,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class CreatePatientProfileDto {
  @IsUUID()
  @IsOptional()
  patientId?: string; // Optional - có thể tạo PatientProfile độc lập

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  phone?: string; // Thêm phone number

  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsObject()
  @IsNotEmpty()
  emergencyContact: object;

  @IsString()
  @IsOptional()
  healthInsurance?: string;

  @IsString()
  @IsOptional()
  relationship?: string;

  @IsOptional()
  @IsBoolean()
  isPregnant?: boolean;

  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;
}
