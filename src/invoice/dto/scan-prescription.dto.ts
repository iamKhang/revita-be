import { IsString, IsNotEmpty } from 'class-validator';

export class ScanPrescriptionDto {
  @IsString()
  @IsNotEmpty()
  prescriptionCode: string;
}
