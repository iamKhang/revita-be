import { IsString, IsNotEmpty } from 'class-validator';

export class CheckoutCounterDto {
  @IsString()
  @IsNotEmpty()
  counterId: string;
}
