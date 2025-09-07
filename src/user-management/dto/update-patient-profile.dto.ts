import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsObject,
} from 'class-validator';

export enum GenderEnum {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export class UpdatePatientProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(GenderEnum)
  gender?: GenderEnum;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsObject()
  emergencyContact?: object;

  @IsOptional()
  @IsString()
  healthInsurance?: string;

  @IsOptional()
  @IsString()
  relationship?: string;
}
