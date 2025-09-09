import { IsObject, IsOptional, IsEnum } from 'class-validator';
import { MedicalRecordStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMedicalRecordDto {
  @ApiPropertyOptional({
    description: 'Nội dung bệnh án cần cập nhật',
    example: {
      chief_complaint: 'Đau đầu',
      diagnosis: 'Stress',
      treatment_plan: 'Nghỉ ngơi và uống thuốc giảm đau',
      attachments: [],
    },
  })
  @IsObject()
  @IsOptional()
  content?: object;

  @ApiPropertyOptional({
    enum: MedicalRecordStatus,
    description: 'Trạng thái hồ sơ bệnh án',
  })
  @IsEnum(MedicalRecordStatus)
  @IsOptional()
  status?: MedicalRecordStatus;
}
