import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNotEmpty, ArrayMinSize } from 'class-validator';

export class AssignServicesDto {
  @ApiProperty({
    description: 'Mã phiếu chỉ định',
    example: 'PRESC2511302115111814',
  })
  @IsString()
  @IsNotEmpty()
  prescriptionCode: string;

  @ApiProperty({
    description: 'Danh sách ID của các PrescriptionService muốn bắt đầu. Có thể là PENDING, RESCHEDULED, hoặc WAITING_RESULT',
    example: ['uuid-service-1', 'uuid-service-2'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  prescriptionServiceIds: string[];
}

