import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSpecialtyDto {
  @IsString()
  @IsNotEmpty()
  specialtyCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imgUrl?: string;
}

export class UpdateSpecialtyDto {
  @IsOptional()
  @IsString()
  specialtyCode?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imgUrl?: string;
}

export class SpecialtyResponseDto {
  id!: string;
  specialtyCode!: string;
  name!: string;
  description?: string;
  imgUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

