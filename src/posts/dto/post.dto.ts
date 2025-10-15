import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ContentStatus } from '@prisma/client';

const transformLimit = (value: unknown, fallback: number, max: number) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
};

const transformOffset = (value: unknown, fallback: number) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
};

export class CreateDraftPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}

export class SeriesAssignmentDto {
  @IsUUID()
  seriesId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  order?: number;
}

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @ArrayNotEmpty()
  @ArrayUnique()
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayUnique()
  @ArrayMaxSize(20)
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeriesAssignmentDto)
  @ArrayMaxSize(20)
  seriesAssignments?: SeriesAssignmentDto[];
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @ArrayUnique()
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayUnique()
  @ArrayMaxSize(20)
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeriesAssignmentDto)
  @ArrayMaxSize(20)
  seriesAssignments?: SeriesAssignmentDto[];
}

export class AdminPostsQueryDto {
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  seriesId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => transformLimit(value, 20, 100))
  limit: number = 20;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => transformOffset(value, 0))
  offset: number = 0;
}

export class PublishedPostsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  seriesId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Transform(({ value }) => transformLimit(value, 10, 50))
  limit: number = 10;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => transformOffset(value, 0))
  offset: number = 0;
}

export class LimitedPostsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Transform(({ value }) => transformLimit(value, 5, 20))
  limit: number = 5;
}
