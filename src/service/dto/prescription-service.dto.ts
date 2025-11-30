import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { PrescriptionStatus } from '@prisma/client';
import { Type } from 'class-transformer';

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
    description: 'ID của PrescriptionService (ID của dịch vụ trong phiếu chỉ định)',
    example: 'uuid-prescription-service-id',
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
    description: 'ID của PrescriptionService (ID của dịch vụ trong phiếu chỉ định)',
    example: 'uuid-prescription-service-id',
  })
  @IsString()
  prescriptionServiceId: string;

  @ApiProperty({
    description: 'Danh sách kết quả (thường là URLs từ Supabase)',
    example: [
      'https://supabase-url.com/results/image1.jpg',
      'https://supabase-url.com/results/report.pdf',
    ],
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

  @ApiProperty({
    description: 'Nếu true, dịch vụ sẽ được đánh dấu là RESCHEDULED (hẹn tiếp tục) thay vì COMPLETED. Mặc định: false',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  shouldReschedule?: boolean;
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

  @ApiProperty({
    description: 'Số lượng items per page',
    example: 50,
    required: false,
    default: 50,
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

// DTO cho get room waiting list
export class GetRoomWaitingListDto {
  @ApiProperty({
    description: 'ID của phòng khám',
    example: 'uuid-room-id',
  })
  @IsString()
  roomId: string;
}

// Response DTO cho room waiting list item
export class RoomWaitingListItemDto {
  @ApiProperty({
    description: 'ID của bệnh nhân',
    example: 'uuid-patient-id',
  })
  patientId: string;

  @ApiProperty({
    description: 'Tên của bệnh nhân',
    example: 'Nguyễn Văn A',
  })
  patientName: string;

  @ApiProperty({
    description: 'Trạng thái dịch vụ',
    example: 'Đang phục vụ',
  })
  status: string;

  @ApiProperty({
    description: 'Tên buồng',
    example: 'Buồng 1',
  })
  boothName: string;
}

// Response DTO cho room waiting list
export class GetRoomWaitingListResponseDto {
  @ApiProperty({
    description: 'Danh sách bệnh nhân đang chờ trong phòng',
    type: [RoomWaitingListItemDto],
  })
  waitingList: RoomWaitingListItemDto[];

  @ApiProperty({
    description: 'Tổng số bệnh nhân đang chờ',
    example: 5,
  })
  total: number;
}
