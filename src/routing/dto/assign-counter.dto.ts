import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AssignCounterDto {
  @IsString()
  @IsNotEmpty()
  counterId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}