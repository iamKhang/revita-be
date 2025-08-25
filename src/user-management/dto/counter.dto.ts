import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateCounterDto {
  @IsString()
  counterCode: string;

  @IsString()
  counterName: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  maxQueue?: number;

  @IsOptional()
  @IsString()
  receptionistId?: string;
}

export class UpdateCounterDto {
  @IsOptional()
  @IsString()
  counterCode?: string;

  @IsOptional()
  @IsString()
  counterName?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  maxQueue?: number;

  @IsOptional()
  @IsString()
  receptionistId?: string;
}
