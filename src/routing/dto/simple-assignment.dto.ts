import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class SimpleAssignmentDto {
  @IsString()
  @IsOptional()
  assignedBy?: string; // ID của receptionist thực hiện bốc số

  @IsString()
  @IsOptional()
  priorityLevel?: 'HIGH' | 'MEDIUM' | 'LOW'; // Chỉ truyền độ ưu tiên nếu cần

  @IsBoolean()
  @IsOptional()
  isVIP?: boolean; // Khám VIP

  @IsBoolean()
  @IsOptional()
  isElderly?: boolean; // >70 tuổi (đặt thủ công khi bốc số)

  @IsBoolean()
  @IsOptional()
  isPregnant?: boolean;

  @IsBoolean()
  @IsOptional()
  isDisabled?: boolean;
}
