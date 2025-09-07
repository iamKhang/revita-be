import { IsString, IsOptional, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkSessionDto {
  @IsDateString()
  startTime: string; // ISO string format

  @IsDateString()
  endTime: string; // ISO string format

  @IsArray()
  @IsString({ each: true })
  serviceIds: string[]; // Danh sách service IDs (bắt buộc để tự động phân phòng)
}

export class CreateWorkSessionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkSessionDto)
  workSessions: CreateWorkSessionDto[];
}

