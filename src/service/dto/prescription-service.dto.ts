import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { PrescriptionStatus } from '@prisma/client';

// DTO cho scan prescription code
export class ScanPrescriptionDto {
  @ApiProperty({
    description: 'Mã phiếu chỉ định',
    example: 'PRE001',
  })
  @IsString()
  prescriptionCode: string;
}

// DTO cho update service status
export class UpdateServiceStatusDto {
  @ApiProperty({
    description: 'ID của prescription service (format: prescriptionId-serviceId)',
    example: 'uuid-prescription-id-uuid-service-id',
  })
  @IsString()
  prescriptionServiceId: string;

  @ApiProperty({
    description: 'Trạng thái mới của service',
    enum: PrescriptionStatus,
    example: PrescriptionStatus.SERVING,
  })
  @IsEnum(PrescriptionStatus)
  status: PrescriptionStatus;

  @ApiProperty({
    description: 'Ghi chú (tùy chọn)',
    example: 'Bắt đầu thực hiện dịch vụ',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

// DTO cho update service results
export class UpdateServiceResultsDto {
  @ApiProperty({
    description: 'ID của prescription service (format: prescriptionId-serviceId)',
    example: 'uuid-prescription-id-uuid-service-id',
  })
  @IsString()
  prescriptionServiceId: string;

  @ApiProperty({
    description: 'Danh sách kết quả (thường là URLs từ Supabase)',
    example: ['https://supabase-url.com/results/image1.jpg', 'https://supabase-url.com/results/report.pdf'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  results: string[];

  @ApiProperty({
    description: 'Ghi chú kết quả (tùy chọn)',
    example: 'Kết quả xét nghiệm bình thường',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

// Response DTO cho scan prescription
export class ScanPrescriptionResponseDto {
  @ApiProperty({
    description: 'Thông tin phiếu chỉ định',
    type: 'object',
    additionalProperties: true,
  })
  prescription: any;

  @ApiProperty({
    description: 'Service đang ở trạng thái WAITING (nếu có)',
    type: 'object',
    additionalProperties: true,
  })
  currentService?: any;
}

// Response DTO cho update service status
export class UpdateServiceStatusResponseDto {
  @ApiProperty({
    description: 'Thông tin service đã được cập nhật',
    type: 'object',
    additionalProperties: true,
  })
  service: any;

  @ApiProperty({
    description: 'Service tiếp theo đã được chuyển sang WAITING (nếu có)',
    type: 'object',
    additionalProperties: true,
  })
  nextService?: any;

  @ApiProperty({
    description: 'Thông báo',
    example: 'Cập nhật trạng thái thành công',
  })
  message: string;
}

// Response DTO cho update results
export class UpdateResultsResponseDto {
  @ApiProperty({
    description: 'Thông tin service đã được cập nhật kết quả',
    type: 'object',
    additionalProperties: true,
  })
  service: any;

  @ApiProperty({
    description: 'Thông báo',
    example: 'Cập nhật kết quả thành công',
  })
  message: string;
}

// DTO cho get services
export class GetServicesDto {
  @ApiProperty({
    description: 'Trạng thái service (tùy chọn)',
    enum: PrescriptionStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;

  @ApiProperty({
    description: 'ID của work session hiện tại (tùy chọn)',
    example: 'uuid-work-session-id',
    required: false,
  })
  @IsOptional()
  @IsString()
  workSessionId?: string;
}


