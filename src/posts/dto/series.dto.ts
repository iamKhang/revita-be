import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SeriesPostItemDto {
  @IsUUID()
  postId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class CreateSeriesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeriesPostItemDto)
  @ArrayMaxSize(200)
  @ArrayUnique((item: SeriesPostItemDto) => item.postId)
  posts?: SeriesPostItemDto[];
}

export class UpdateSeriesDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeriesPostItemDto)
  @ArrayMaxSize(200)
  @ArrayUnique((item: SeriesPostItemDto) => item.postId)
  posts?: SeriesPostItemDto[];
}
