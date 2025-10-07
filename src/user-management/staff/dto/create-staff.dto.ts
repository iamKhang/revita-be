import { Role } from '@prisma/client';
import { CertificateDto } from './certificate.dto';
import { IsArray, IsDateString, IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DoctorInfoDto {
  @IsOptional()
  yearsExperience?: number;

  @IsOptional()
  rating?: number;

  @IsOptional()
  @IsString()
  workHistory?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  specialtyId!: string; // Required for DOCTOR

  @IsOptional()
  @IsArray()
  @Type(() => String)
  subSpecialties?: string[];

  @IsOptional()
  @IsString()
  licenseNumber?: string | null;

  @IsOptional()
  @IsDateString()
  licenseIssuedAt?: Date | string | null;

  @IsOptional()
  @IsDateString()
  licenseExpiry?: Date | string | null;

  @IsOptional()
  @IsString()
  department?: string | null;

  @IsOptional()
  @IsString()
  position?: string | null;
}

export class CreateStaffDto {
  // Auth basics
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDateString()
  dateOfBirth!: Date | string;

  @IsString()
  @IsNotEmpty()
  gender!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsEnum(Role)
  role!: Role; // DOCTOR | RECEPTIONIST | TECHNICIAN | CASHIER | ADMIN

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  avatar?: string | null;

  @IsOptional()
  @IsString()
  citizenId?: string | null;

  // Role-specific payloads - doctorInfo is required for DOCTOR role
  @ValidateNested()
  @Type(() => DoctorInfoDto)
  doctorInfo?: DoctorInfoDto;

  technicianInfo?: Record<string, never>;
  receptionistInfo?: Record<string, never>;
  cashierInfo?: Record<string, never>;
  @IsOptional()
  @IsObject()
  adminInfo?: { position?: string | null };

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificateDto)
  certificates?: CertificateDto[];
}
