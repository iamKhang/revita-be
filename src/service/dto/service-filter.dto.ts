/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsArray,
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

const transformLimit = ({ value }: TransformFnParams, fallback: number) => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  const parsed = parseInt(value as string, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const transformOffset = ({ value }: TransformFnParams) => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  const parsed = parseInt(value as string, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const transformTrim = ({ value }: TransformFnParams) => {
  if (typeof value !== 'string') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const transformServiceIds = ({
  value,
}: TransformFnParams): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v.trim() : String(v).trim()))
      .filter((v) => v.length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    // Support comma-separated values
    return trimmed
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  return undefined;
};

export class DoctorServiceQueryDto {
  @IsOptional()
  @IsString()
  @Transform(transformTrim)
  keyword?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform((params) => transformLimit(params, 20))
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(transformOffset)
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  @Transform(transformBoolean)
  includeInactive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(transformBoolean)
  requiresDoctor?: boolean;
}

export class ServiceLocationQueryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(transformServiceIds)
  serviceIds?: string[];

  @IsOptional()
  @IsString()
  @Transform(transformTrim)
  serviceId?: string; // Deprecated: use serviceIds instead, kept for backward compatibility

  @IsOptional()
  @IsString()
  @Transform(transformTrim)
  boothId?: string;

  @IsOptional()
  @IsString()
  @Transform(transformTrim)
  clinicRoomId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(transformServiceIds)
  excludeServiceIds?: string[];

  @IsOptional()
  @IsString()
  @Transform(transformTrim)
  excludeServiceId?: string; // Deprecated: use excludeServiceIds instead

  @IsOptional()
  @IsString()
  @Transform(transformTrim)
  keyword?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform((params) => transformLimit(params, 20))
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(transformOffset)
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  @Transform(transformBoolean)
  includeInactive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(transformBoolean)
  requiresDoctor?: boolean;
}
