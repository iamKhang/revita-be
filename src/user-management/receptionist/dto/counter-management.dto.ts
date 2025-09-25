import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class OpenCounterDto {
  @IsString()
  @IsNotEmpty()
  counterId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseCounterDto {
  @IsString()
  @IsNotEmpty()
  counterId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CounterStatusResponseDto {
  counterId: string;
  counterCode: string;
  counterName: string;
  location?: string;
  isActive: boolean;
  currentAssignment?: {
    id: string;
    receptionistId: string;
    receptionistName: string;
    assignedAt: Date;
    status: string;
    notes?: string;
  };
}

export class CounterListResponseDto {
  counters: CounterStatusResponseDto[];
}
