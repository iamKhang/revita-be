import { IsString, IsOptional } from 'class-validator';

export class SearchPatientProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  profileCode?: string;

  @IsString()
  @IsOptional()
  code?: string; // Alias for profileCode for easier usage
}
