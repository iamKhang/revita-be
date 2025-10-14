import { IsEnum, IsOptional, IsDateString } from 'class-validator';

export enum TimePeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export class QueryPeriodDto {
  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod = TimePeriod.DAY;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

