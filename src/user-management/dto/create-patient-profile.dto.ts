import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsObject,
} from 'class-validator';

export class CreatePatientProfileDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

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
}
