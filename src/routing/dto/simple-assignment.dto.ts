import { IsString, IsOptional } from 'class-validator';

export class SimpleAssignmentDto {
  @IsString()
  @IsOptional()
  assignedBy?: string; // ID của receptionist thực hiện bốc số
}
