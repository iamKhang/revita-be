import {
  IsNotEmpty,
  IsNumber,
  ValidateNested,
  IsArray,
  IsString,
  Matches,
  Min,
  Max,
  IsOptional,
  IsDateString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class WorkingSessionDto {
  @ApiProperty({
    description: 'Giờ bắt đầu ca làm việc (format: HH:mm)',
    example: '08:00',
  })
  @IsString({ message: 'Giờ bắt đầu phải là chuỗi' })
  @IsNotEmpty({ message: 'Giờ bắt đầu không được để trống' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Giờ bắt đầu phải có định dạng HH:mm',
  })
  startTime: string;

  @ApiProperty({
    description: 'Giờ kết thúc ca làm việc (format: HH:mm)',
    example: '12:00',
  })
  @IsString({ message: 'Giờ kết thúc phải là chuỗi' })
  @IsNotEmpty({ message: 'Giờ kết thúc không được để trống' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Giờ kết thúc phải có định dạng HH:mm',
  })
  endTime: string;

  @ApiProperty({
    description: 'Loại ca làm việc',
    example: 'morning',
    enum: ['morning', 'afternoon', 'evening', 'night'],
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Loại ca làm việc phải là chuỗi' })
  @IsIn(['morning', 'afternoon', 'evening', 'night'], {
    message: 'Loại ca làm việc phải là morning, afternoon, evening hoặc night',
  })
  sessionType?: string;

  @ApiProperty({
    description: 'Mô tả ca làm việc',
    example: 'Khám bệnh tổng quát',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  description?: string;
}

export class WorkingDayDto {
  @ApiProperty({
    description: 'Ngày làm việc (format: YYYY-MM-DD)',
    example: '2024-12-03',
  })
  @IsDateString({}, { message: 'Ngày làm việc không hợp lệ' })
  @IsNotEmpty({ message: 'Ngày làm việc không được để trống' })
  workingDate: string;

  @ApiProperty({
    description: 'Danh sách các ca làm việc trong ngày',
    type: [WorkingSessionDto],
  })
  @IsArray({ message: 'Danh sách ca làm việc phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => WorkingSessionDto)
  sessions: WorkingSessionDto[];
}

export class CreateMonthlyScheduleDto {
  @ApiProperty({
    description: 'Tháng (1-12)',
    example: 12,
    minimum: 1,
    maximum: 12,
  })
  @IsNumber({}, { message: 'Tháng phải là số' })
  @IsNotEmpty({ message: 'Tháng không được để trống' })
  @Min(1, { message: 'Tháng phải từ 1 đến 12' })
  @Max(12, { message: 'Tháng phải từ 1 đến 12' })
  month: number;

  @ApiProperty({
    description: 'Năm',
    example: 2024,
    minimum: 2024,
  })
  @IsNumber({}, { message: 'Năm phải là số' })
  @IsNotEmpty({ message: 'Năm không được để trống' })
  @Min(2024, { message: 'Năm phải từ 2024 trở đi' })
  year: number;

  @ApiProperty({
    description: 'Danh sách các ngày làm việc trong tháng',
    type: [WorkingDayDto],
  })
  @IsArray({ message: 'Danh sách ngày làm việc phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => WorkingDayDto)
  workingDays: WorkingDayDto[];
}
