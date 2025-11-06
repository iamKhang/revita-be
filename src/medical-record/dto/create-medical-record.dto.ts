import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsEnum,
  IsArray,
} from 'class-validator';
import { MedicalRecordStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMedicalRecordDto {
  @ApiProperty({ description: 'ID của hồ sơ bệnh nhân' })
  @IsNotEmpty()
  patientProfileId: string;

  @ApiProperty({ description: 'ID của template bệnh án' })
  @IsNotEmpty()
  templateId: string;

  @ApiPropertyOptional({
    description:
      'ID của bác sĩ hoặc authId của bác sĩ (tùy chọn cho admin, bắt buộc nếu admin muốn chỉ định bác sĩ cụ thể)',
    example: 'doctor-uuid-1 hoặc auth-uuid-1',
  })
  @IsOptional()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'ID của cuộc hẹn (tùy chọn)' })
  @IsOptional()
  appointmentId?: string;

  @ApiPropertyOptional({
    enum: MedicalRecordStatus,
    description: 'Trạng thái hồ sơ bệnh án',
  })
  @IsEnum(MedicalRecordStatus)
  @IsOptional()
  status?: MedicalRecordStatus;

  @ApiProperty({
    description: 'Nội dung bệnh án theo template',
    example: {
      chief_complaint: 'Đau đầu',
      diagnosis: 'Stress',
      treatment_plan: 'Nghỉ ngơi và uống thuốc giảm đau',
      attachments: [],
    },
  })
  @IsObject()
  @IsNotEmpty()
  content: object;
}

export class MedicalRecordAttachmentDto {
  @ApiProperty({ description: 'Tên file gốc' })
  filename: string;

  @ApiProperty({ description: 'Loại file (MIME type)' })
  filetype: string;

  @ApiProperty({ description: 'URL công khai của file' })
  url: string;

  @ApiPropertyOptional({ description: 'Thời gian upload' })
  uploadedAt?: string;
}

export class RemoveAttachmentsDto {
  @ApiProperty({
    description: 'Danh sách URL của files cần xóa',
    type: [String],
    example: [
      'https://xxx.supabase.co/storage/v1/object/public/results/medical-records/uuid/file1.pdf',
      'https://xxx.supabase.co/storage/v1/object/public/results/medical-records/uuid/file2.jpg',
    ],
  })
  @IsArray()
  @IsNotEmpty()
  urls: string[];
}
