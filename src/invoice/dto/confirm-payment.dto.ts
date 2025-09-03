import { IsString, IsNotEmpty } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  invoiceCode: string;

  @IsNotEmpty()
  cashierId: string;
}
