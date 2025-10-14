import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { TimePeriod } from './query-period.dto';

// Request DTOs
export class TimeBasedQueryDto {
  @IsEnum(TimePeriod)
  period: TimePeriod;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Response DTOs for Appointments by Time
export class AppointmentTimeDataDto {
  date: string; // ISO date string
  total: number; // Tổng lịch hẹn
  completed: number; // Đã hoàn thành
  pending: number; // Chờ xác nhận
  cancelled: number; // Đã hủy
  confirmed: number; // Đã xác nhận
}

export class AppointmentsByTimeResponseDto {
  data: AppointmentTimeDataDto[];
  period: {
    startDate: string;
    endDate: string;
    periodType: string;
  };
}

// Response DTOs for Examinations by Time
export class ExaminationTimeDataDto {
  date: string;
  totalAppointments: number;
  completedAppointments: number;
  averageDurationMinutes: number;
}

export class ExaminationsByTimeResponseDto {
  data: ExaminationTimeDataDto[];
  period: {
    startDate: string;
    endDate: string;
    periodType: string;
  };
}

// Response DTOs for Revenue by Time
export class RevenueTimeDataDto {
  date: string;
  totalRevenue: number;
  paidRevenue: number;
  accountsReceivable: number;
}

export class RevenueByTimeResponseDto {
  data: RevenueTimeDataDto[];
  period: {
    startDate: string;
    endDate: string;
    periodType: string;
  };
}
