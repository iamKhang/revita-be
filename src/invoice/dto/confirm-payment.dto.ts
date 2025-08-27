import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  invoiceCode: string;

  @IsUUID()
  @IsNotEmpty()
  cashierId: string;
}
