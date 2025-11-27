import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  IsDateString,
  IsUUID,
} from 'class-validator';
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

export class UpsertServicePromotionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  allowLoyaltyDiscount?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDiscountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ServicePromotionQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 20))
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 0))
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  @Transform(transformBoolean)
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(transformBoolean)
  allowLoyaltyDiscount?: boolean;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

