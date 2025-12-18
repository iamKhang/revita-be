import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTO cho query lịch sử khám bệnh của bệnh nhân
export class PatientServiceHistoryQueryDto {
  @ApiProperty({
    description: 'ID của specialty để lọc dịch vụ theo khoa (tùy chọn)',
    example: 'uuid-specialty-id',
    required: false,
  })
  @IsOptional()
  @IsString()
  specialtyId?: string;

  @ApiProperty({
    description: 'ID của doctor để lọc dịch vụ do bác sĩ thực hiện (tùy chọn)',
    example: 'uuid-doctor-id',
    required: false,
  })
  @IsOptional()
  @IsString()
  doctorId?: string;

  @ApiProperty({
    description: 'ID của technician để lọc dịch vụ do kỹ thuật viên thực hiện (tùy chọn)',
    example: 'uuid-technician-id',
    required: false,
  })
  @IsOptional()
  @IsString()
  technicianId?: string;

  @ApiProperty({
    description: 'Số lượng items per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Số lượng items để skip',
    example: 0,
    required: false,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}
