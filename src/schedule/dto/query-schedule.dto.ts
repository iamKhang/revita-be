import {
  IsOptional,
  IsNumber,
  IsString,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum ScheduleStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum RequestType {
  MONTHLY_SCHEDULE = 'MONTHLY_SCHEDULE',
  ADD_HOURS = 'ADD_HOURS',
  CANCEL_HOURS = 'CANCEL_HOURS',
  FULL_DAY_OFF = 'FULL_DAY_OFF',
}

export class QueryScheduleDto {
  @ApiProperty({
    description: 'Tháng (1-12)',
    example: 12,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tháng phải là số' })
  @Min(1, { message: 'Tháng phải từ 1 đến 12' })
  @Max(12, { message: 'Tháng phải từ 1 đến 12' })
  month?: number;

  @ApiProperty({
    description: 'Năm',
    example: 2024,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Năm phải là số' })
  @Min(2024, { message: 'Năm phải từ 2024 trở đi' })
  year?: number;

  @ApiProperty({
    description: 'Trạng thái đơn gửi lịch',
    enum: ScheduleStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ScheduleStatus, { message: 'Trạng thái lịch không hợp lệ' })
  status?: ScheduleStatus;

  @ApiProperty({
    description: 'ID bác sĩ (chỉ dành cho clinic admin)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'ID bác sĩ phải là chuỗi' })
  doctorId?: string;
}

export class QueryWorkingDaysDto {
  @ApiProperty({
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
    example: '2024-12-01',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Ngày bắt đầu phải là chuỗi' })
  startDate?: string;

  @ApiProperty({
    description: 'Ngày kết thúc (YYYY-MM-DD)',
    example: '2024-12-31',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Ngày kết thúc phải là chuỗi' })
  endDate?: string;

  @ApiProperty({
    description: 'ID bác sĩ (chỉ dành cho clinic admin)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'ID bác sĩ phải là chuỗi' })
  doctorId?: string;

  @ApiProperty({
    description: 'Chỉ lấy ngày còn hiệu lực',
    example: true,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  activeOnly?: boolean = true;
}

export class QueryScheduleRequestDto {
  @ApiProperty({
    description: 'Loại yêu cầu',
    enum: RequestType,
    required: false,
  })
  @IsOptional()
  @IsEnum(RequestType, { message: 'Loại yêu cầu không hợp lệ' })
  requestType?: RequestType;

  @ApiProperty({
    description: 'Trạng thái yêu cầu',
    enum: RequestStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(RequestStatus, { message: 'Trạng thái yêu cầu không hợp lệ' })
  status?: RequestStatus;

  @ApiProperty({
    description: 'ID bác sĩ (chỉ dành cho clinic admin)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'ID bác sĩ phải là chuỗi' })
  doctorId?: string;

  @ApiProperty({
    description: 'Số trang',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Số trang phải là số' })
  @Min(1, { message: 'Số trang phải lớn hơn 0' })
  page?: number = 1;

  @ApiProperty({
    description: 'Số lượng bản ghi mỗi trang',
    example: 10,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Số lượng bản ghi phải là số' })
  @Min(1, { message: 'Số lượng bản ghi phải lớn hơn 0' })
  @Max(100, { message: 'Số lượng bản ghi không được vượt quá 100' })
  limit?: number = 10;
}
