import { IsString, IsArray, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

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

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod; // CASH, TRANSFER, etc.

  @IsOptional()
  @IsString()
  cashierId?: string; // Optional, can be extracted from JWT token

  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
