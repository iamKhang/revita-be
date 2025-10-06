import { IsOptional, IsString } from 'class-validator';

export class RefreshPaymentDto {
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
