import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UploadFileResponseDto {
  @ApiProperty({
    description: 'URL của file đã upload',
    example: 'https://djjeccafahozffgadysws.supabase.co/storage/v1/object/public/results/medical-report.pdf',
  })
  @IsString()
  url: string;

  @ApiProperty({
    description: 'Tên file gốc',
    example: 'medical-report.pdf',
  })
  @IsString()
  originalName: string;

  @ApiProperty({
    description: 'Tên file trong storage',
    example: 'uuid-medical-report.pdf',
  })
  @IsString()
  fileName: string;

  @ApiProperty({
    description: 'Kích thước file (bytes)',
    example: 1024000,
  })
  @IsString()
  size: number;

  @ApiProperty({
    description: 'Loại file (MIME type)',
    example: 'application/pdf',
  })
  @IsString()
  mimeType: string;

  @ApiProperty({
    description: 'Thời gian upload',
    example: '2024-01-15T10:30:00Z',
  })
  @IsString()
  uploadedAt: string;
}

export class GetFileUrlDto {
  @ApiProperty({
    description: 'Tên file trong storage',
    example: 'uuid-medical-report.pdf',
  })
  @IsString()
  fileName: string;

  @ApiProperty({
    description: 'Thư mục trong bucket (tùy chọn)',
    example: 'medical-reports/',
    required: false,
  })
  @IsOptional()
  @IsString()
  folder?: string;
}

export class GetFileUrlResponseDto {
  @ApiProperty({
    description: 'URL công khai của file',
    example: 'https://djjeccafahozffgadysws.supabase.co/storage/v1/object/public/results/medical-report.pdf',
  })
  @IsString()
  url: string;

  @ApiProperty({
    description: 'Tên file',
    example: 'uuid-medical-report.pdf',
  })
  @IsString()
  fileName: string;
}
