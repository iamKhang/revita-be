import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TakeNumberDto {
  @IsString()
  @IsOptional()
  patientProfileCode?: string; // Mã hồ sơ bệnh nhân

  @IsString()
  @IsOptional()
  appointmentCode?: string; // Mã lịch khám


  @IsString()
  @IsOptional()
  patientName?: string; // Tên bệnh nhân (nếu không có mã)

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(150)
  patientAge?: number; // Tuổi bệnh nhân (bắt buộc nếu không có mã)

  @IsString()
  @IsOptional()
  patientPhone?: string; // Số điện thoại (nếu không có mã)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  birthYear?: number; // Năm sinh (dùng khi nhập thủ công)

  @IsBoolean()
  @IsOptional()
  isPregnant?: boolean; // Phụ nữ có thai

  @IsBoolean()
  @IsOptional()
  isDisabled?: boolean; // Người khuyết tật
}
