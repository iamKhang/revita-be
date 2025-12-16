import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
  IsUUID,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({
    description: 'Mã code của template (unique)',
    example: 'NOI_KHOA_V2',
  })
  @IsString()
  @IsNotEmpty()
  templateCode: string;

  @ApiProperty({
    description: 'Tên template',
    example: 'Nội khoa',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Cấu trúc fields của template (JSON)',
    example: {
      fields: [
        {
          name: 'chief_complaint',
          label: 'Triệu chứng chính',
          type: 'string',
          required: true,
        },
      ],
    },
  })
  @IsObject()
  @IsNotEmpty()
  fields: Record<string, any>;

  @ApiProperty({
    description: 'ID của chuyên khoa',
    example: 'uuid-specialty-id',
  })
  @IsUUID()
  @IsNotEmpty()
  specialtyId: string;

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Cho phép sử dụng chuẩn đoán tự động',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enableAutoDiagnosis?: boolean;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional({
    description: 'Tên template',
    example: 'Nội khoa (Cập nhật)',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Cấu trúc fields của template (JSON)',
  })
  @IsOptional()
  @IsObject()
  fields?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'ID của chuyên khoa',
  })
  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Cho phép sử dụng chuẩn đoán tự động',
  })
  @IsOptional()
  @IsBoolean()
  enableAutoDiagnosis?: boolean;
}

export class TemplateQueryDto {
  @ApiPropertyOptional({
    description: 'Số lượng records trên mỗi trang',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Số trang (bắt đầu từ 0)',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    description: 'Lọc theo specialtyId',
  })
  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái hoạt động',
  })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tên hoặc templateCode',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

