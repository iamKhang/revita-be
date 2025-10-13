import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSpecialtyDto {
  @IsString()
  @IsNotEmpty()
  specialtyCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateSpecialtyDto {
  @IsOptional()
  @IsString()
  specialtyCode?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class SpecialtyResponseDto {
  id!: string;
  specialtyCode!: string;
  name!: string;
  createdAt?: Date;
  updatedAt?: Date;
}

