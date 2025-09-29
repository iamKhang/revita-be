import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  invoiceCode: string;

  @IsNotEmpty()
  cashierId: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}
