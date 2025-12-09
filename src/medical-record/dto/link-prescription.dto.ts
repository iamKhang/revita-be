import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkPrescriptionDto {
  @ApiProperty({
    description: 'Mã code của phiếu chỉ định cần liên kết',
    example: 'PRESC2512051239282014',
  })
  @IsNotEmpty()
  @IsString()
  prescriptionCode: string;
}




