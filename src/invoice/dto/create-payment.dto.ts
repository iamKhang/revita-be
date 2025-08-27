import { IsString, IsArray, IsNotEmpty, IsUUID, ArrayNotEmpty, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  prescriptionCode: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  selectedServiceIds: string[];

  @IsString()
  @IsNotEmpty()
  paymentMethod: string; // CASH, CARD, TRANSFER, etc.

  @IsOptional()
  @IsString()
  cashierId?: string; // Optional, can be extracted from JWT token
}
