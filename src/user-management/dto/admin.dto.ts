import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  IsDateString,
  IsEmail,
} from 'class-validator';
import { Role } from '../../rbac/roles.enum';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  gender: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  citizenId?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(Role)
  role: Role;

  // Doctor specific fields
  @IsOptional()
  @IsArray()
  degrees?: any[];

  @IsOptional()
  @IsNumber()
  yearsExperience?: number;

  @IsOptional()
  @IsString()
  workHistory?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Patient specific fields
  @IsOptional()
  @IsNumber()
  loyaltyPoints?: number;

  // Admin specific fields
  @IsOptional()
  @IsString()
  adminCode?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  citizenId?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // Doctor specific fields
  @IsOptional()
  @IsArray()
  degrees?: any[];

  @IsOptional()
  @IsNumber()
  yearsExperience?: number;

  @IsOptional()
  @IsString()
  workHistory?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Patient specific fields
  @IsOptional()
  @IsNumber()
  loyaltyPoints?: number;

  // Admin specific fields
  @IsOptional()
  @IsString()
  adminCode?: string;
}
