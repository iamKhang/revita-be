import { IsString, IsArray, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  prescriptionCode: string;

  @IsOptional()
  @IsArray()
  selectedServiceIds?: string[];

  @IsOptional()
  @IsArray()
  selectedServiceCodes?: string[];

  @IsString()
  @IsNotEmpty()
  paymentMethod: string; // CASH, CARD, TRANSFER, etc.

  @IsOptional()
  @IsString()
  cashierId?: string; // Optional, can be extracted from JWT token
}
