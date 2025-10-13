import { CertificateDto } from './certificate.dto';
import { IsArray, IsDateString, IsEmail, IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateStaffDto {
  // Auth basics (all optional)
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date | string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  address?: string;

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

  // Role-specific updates
  @IsOptional()
  @IsObject()
  doctorInfo?: {
    yearsExperience?: number;
    rating?: number;
    workHistory?: string;
    description?: string;
    specialtyId?: string | null;
    subSpecialties?: string[];
    licenseNumber?: string | null;
    licenseIssuedAt?: Date | string | null;
    licenseExpiry?: Date | string | null;
    department?: string | null;
    position?: string | null;
    isActive?: boolean;
  };

  @IsOptional()
  @IsObject()
  technicianInfo?: { isActive?: boolean };

  @IsOptional()
  @IsObject()
  receptionistInfo?: { isActive?: boolean };

  @IsOptional()
  @IsObject()
  cashierInfo?: { isActive?: boolean };

  @IsOptional()
  @IsObject()
  adminInfo?: { isActive?: boolean; position?: string | null };

  // Certificates: if provided and replaceAll=true, will replace existing
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificateDto)
  certificates?: CertificateDto[];

  @IsOptional()
  replaceAllCertificates?: boolean;
}
