import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsObject,
  IsBoolean,
} from 'class-validator';

export class CreateIndependentPatientProfileDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

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

  @IsUUID()
  @IsOptional()
  patientId?: string; // Optional - để liên kết với Patient nếu cần

  @IsOptional()
  @IsBoolean()
  isPregnant?: boolean;

  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;
}
