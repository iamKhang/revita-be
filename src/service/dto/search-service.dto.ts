import { IsString, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

const transformBoolean = ({ value, obj, key }: TransformFnParams) => {
  const raw = obj?.[key];
  const input = raw ?? value;

  if (input === undefined || input === null || input === '') {
    return undefined;
  }

  if (typeof input === 'boolean') {
    return input;
  }

  if (typeof input === 'string') {
    const normalized = input.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  if (typeof input === 'number') {
    if (input === 1) {
      return true;
    }
    if (input === 0) {
      return false;
    }
  }

  return Boolean(input);
};

export class SearchServiceDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  query: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value) || 10)
  limit?: number = 10;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value) || 0)
  offset?: number = 0;
}

export class AdvancedSearchDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  keyword: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value) || 20)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value) || 0)
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  @Transform(transformBoolean)
  requiresDoctor?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(transformBoolean)
  isActive?: boolean;
}

export class GetAllServicesDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value) || 50)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value) || 0)
  offset?: number = 0;
}
