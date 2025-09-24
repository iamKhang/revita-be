import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

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

  @IsBoolean()
  @IsOptional()
  isPregnant?: boolean; // Phụ nữ có thai

  @IsBoolean()
  @IsOptional()
  isDisabled?: boolean; // Người khuyết tật

  @IsBoolean()
  @IsOptional()
  isElderly?: boolean; // Người cao tuổi

  @IsBoolean()
  @IsOptional()
  isVIP?: boolean; // Khám VIP

  @IsString()
  @IsOptional()
  notes?: string; // Ghi chú thêm
}

