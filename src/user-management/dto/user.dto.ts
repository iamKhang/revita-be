import { IsString, IsDate, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UserDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsDate()
  @Type(() => Date)
  dateOfBirth: Date;

  @IsString()
  gender: string;

  @IsOptional()
  @IsString()
  avatar?: string | null;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  citizenId?: string | null;

  @IsString()
  role: string;

  @IsBoolean()
  isActive: boolean;
}

export class CreateUserDto {
  @IsString()
  name: string;

  @IsDate()
  @Type(() => Date)
  dateOfBirth: Date;

  @IsString()
  gender: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  citizenId?: string;

  @IsString()
  role: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  clinicId?: string; // cho Doctor, Receptionist, ClinicAdmin
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateOfBirth?: Date;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  citizenId?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  clinicId?: string;
}
