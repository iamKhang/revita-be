import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum RequestType {
  ADD_HOURS = 'ADD_HOURS',
  CANCEL_HOURS = 'CANCEL_HOURS',
  FULL_DAY_OFF = 'FULL_DAY_OFF',
}

export class CreateScheduleRequestDto {
  @ApiProperty({
    description: 'Loại yêu cầu',
    enum: RequestType,
    example: RequestType.ADD_HOURS,
  })
  @IsEnum(RequestType, { message: 'Loại yêu cầu không hợp lệ' })
  @IsNotEmpty({ message: 'Loại yêu cầu không được để trống' })
  requestType: RequestType;

  @ApiProperty({
    description: 'Ngày yêu cầu thay đổi (YYYY-MM-DD)',
    example: '2024-12-15',
  })
  @IsDateString({}, { message: 'Ngày yêu cầu không hợp lệ' })
  @IsNotEmpty({ message: 'Ngày yêu cầu không được để trống' })
  requestDate: string;

  @ApiProperty({
    description: 'Giờ bắt đầu (format: HH:mm) - Bắt buộc cho ADD_HOURS và CANCEL_HOURS',
    example: '18:00',
    required: false,
  })
  @ValidateIf((o) => o.requestType !== RequestType.FULL_DAY_OFF)
  @IsString({ message: 'Giờ bắt đầu phải là chuỗi' })
  @IsNotEmpty({ message: 'Giờ bắt đầu không được để trống cho loại yêu cầu này' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Giờ bắt đầu phải có định dạng HH:mm',
  })
  startTime?: string;

  @ApiProperty({
    description: 'Giờ kết thúc (format: HH:mm) - Bắt buộc cho ADD_HOURS và CANCEL_HOURS',
    example: '20:00',
    required: false,
  })
  @ValidateIf((o) => o.requestType !== RequestType.FULL_DAY_OFF)
  @IsString({ message: 'Giờ kết thúc phải là chuỗi' })
  @IsNotEmpty({ message: 'Giờ kết thúc không được để trống cho loại yêu cầu này' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Giờ kết thúc phải có định dạng HH:mm',
  })
  endTime?: string;

  @ApiProperty({
    description: 'Lý do yêu cầu',
    example: 'Có ca cấp cứu cần hỗ trợ',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Lý do phải là chuỗi' })
  reason?: string;

  @ApiProperty({
    description: 'Mô tả chi tiết',
    example: 'Bệnh nhân cần phẫu thuật khẩn cấp, cần thêm giờ để hỗ trợ',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  description?: string;
}
