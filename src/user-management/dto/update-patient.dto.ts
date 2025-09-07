import { IsString, IsOptional, IsDateString, IsNumber } from 'class-validator';

export class UpdatePatientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  citizenId?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  // Patient-specific fields
  @IsOptional()
  @IsNumber()
  loyaltyPoints?: number;
}
