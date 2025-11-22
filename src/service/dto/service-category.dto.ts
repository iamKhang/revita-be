import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  Max,
  Min,
} from 'class-validator';

export class ServiceCategoryListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Transform(({ value }) =>
    value !== undefined ? Math.min(parseInt(value, 10), 1000) || 100 : 100,
  )
  limit?: number = 100;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) =>
    value !== undefined ? Math.max(parseInt(value, 10), 0) || 0 : 0,
  )
  offset?: number = 0;
}

export class CreateServiceCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateServiceCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
