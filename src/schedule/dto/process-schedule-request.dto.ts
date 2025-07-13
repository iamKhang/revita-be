import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum RequestStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ConflictAction {
  CANCEL_APPOINTMENTS = 'CANCEL_APPOINTMENTS',
  RESCHEDULE_APPOINTMENTS = 'RESCHEDULE_APPOINTMENTS',
  REJECT_REQUEST = 'REJECT_REQUEST',
}

export class ProcessScheduleRequestDto {
  @ApiProperty({
    description: 'Trạng thái xử lý',
    enum: RequestStatus,
    example: RequestStatus.APPROVED,
  })
  @IsEnum(RequestStatus, { message: 'Trạng thái xử lý không hợp lệ' })
  @IsNotEmpty({ message: 'Trạng thái xử lý không được để trống' })
  status: RequestStatus;

  @ApiProperty({
    description: 'Ghi chú của admin',
    example: 'Đã duyệt yêu cầu thêm giờ làm',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  adminNote?: string;

  @ApiProperty({
    description: 'Hành động xử lý xung đột với lịch bệnh nhân (chỉ áp dụng khi có xung đột)',
    enum: ConflictAction,
    required: false,
  })
  @IsOptional()
  @IsEnum(ConflictAction, { message: 'Hành động xử lý xung đột không hợp lệ' })
  conflictAction?: ConflictAction;

  @ApiProperty({
    description: 'Danh sách ID appointment bị ảnh hưởng (chỉ áp dụng khi có xung đột)',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách appointment phải là mảng' })
  @IsString({ each: true, message: 'ID appointment phải là chuỗi' })
  affectedAppointments?: string[];
}
