import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import {
  QueryPeriodDto,
  QuickKpiResponseDto,
  RevenueResponseDto,
  WorkSessionStatsResponseDto,
  ExaminationVolumeStatsResponseDto,
  PaymentMethodStatsResponseDto,
  TopServicesStatsResponseDto,
  PatientSpendingHistoryResponseDto,
  PatientSpendingQueryDto,
  TimeBasedQueryDto,
  AppointmentsByTimeResponseDto,
  ExaminationsByTimeResponseDto,
  RevenueByTimeResponseDto,
} from './dto';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { RolesGuard } from '../rbac/roles.guard';
import { CurrentUser, CurrentUserData } from '../rbac/current-user.decorator';

@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  /**
   * GET /statistics/kpi
   * Lấy KPI nhanh: lượt đặt khám, % xác nhận/hoàn tất/hủy, bệnh nhân mới/quay lại, điểm đánh giá TB bác sĩ
   */
  @Get('kpi')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.TECHNICIAN)
  async getQuickKpi(
    @Query() query: QueryPeriodDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<QuickKpiResponseDto> {
    return this.statisticsService.getQuickKpi(query, user);
  }

  /**
   * GET /statistics/revenue
   * Thống kê doanh thu: tổng/paid/AR, theo ngày–tuần–tháng; theo Specialty/Service
   */
  @Get('revenue')
  @Roles(Role.ADMIN, Role.CASHIER)
  async getRevenueStats(
    @Query() query: QueryPeriodDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<RevenueResponseDto> {
    return this.statisticsService.getRevenueStats(query, user);
  }

  /**
   * GET /statistics/work-sessions
   * Thống kê lịch làm việc: WorkSession theo bác sĩ/kỹ thuật viên, tỉ lệ phiên COMPLETED/CANCELED
   */
  @Get('work-sessions')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.TECHNICIAN)
  async getWorkSessionStats(
    @Query() query: QueryPeriodDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<WorkSessionStatsResponseDto> {
    return this.statisticsService.getWorkSessionStats(query, user);
  }

  /**
   * GET /statistics/examination-volume
   * Thống kê khối lượng khám: ca/bác sĩ/ngày-tuần-tháng; thời lượng bình quân/ca
   */
  @Get('examination-volume')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.TECHNICIAN)
  async getExaminationVolumeStats(
    @Query() query: QueryPeriodDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ExaminationVolumeStatsResponseDto> {
    return this.statisticsService.getExaminationVolumeStats(query, user);
  }

  /**
   * GET /statistics/payment-methods
   * Thống kê doanh thu & phương thức: theo PaymentMethod (CASH/TRANSFER), % paid
   */
  @Get('payment-methods')
  @Roles(Role.ADMIN, Role.CASHIER)
  async getPaymentMethodStats(
    @Query() query: QueryPeriodDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PaymentMethodStatsResponseDto> {
    return this.statisticsService.getPaymentMethodStats(query, user);
  }

  /**
   * GET /statistics/top-services
   * Thống kê top dịch vụ/gói: theo lượt & doanh thu; cơ cấu doanh thu
   */
  @Get('top-services')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  async getTopServicesStats(
    @Query() query: QueryPeriodDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<TopServicesStatsResponseDto> {
    return this.statisticsService.getTopServicesStats(query, user);
  }

  /**
   * GET /statistics/patient-spending
   * Lịch sử chi tiêu / gia đình (mỗi Patient chứa nhiều PatientProfile)
   * Query params: patientId hoặc patientProfileId
   */
  @Get('patient-spending')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.CASHIER, Role.DOCTOR, Role.PATIENT)
  async getPatientSpendingHistory(
    @Query() spendingQuery: PatientSpendingQueryDto,
    @Query() periodQuery: QueryPeriodDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PatientSpendingHistoryResponseDto> {
    return this.statisticsService.getPatientSpendingHistory(
      spendingQuery,
      periodQuery,
      user,
    );
  }

  /**
   * GET /statistics/appointments/by-time
   * Thống kê lịch hẹn theo thời gian: cung cấp dữ liệu cho biểu đồ xu hướng lịch hẹn
   */
  @Get('appointments/by-time')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.TECHNICIAN)
  async getAppointmentsByTime(
    @Query() query: TimeBasedQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AppointmentsByTimeResponseDto> {
    return this.statisticsService.getAppointmentsByTime(query, user);
  }

  /**
   * GET /statistics/examinations/by-time
   * Thống kê khám bệnh theo thời gian: cung cấp dữ liệu cho biểu đồ xu hướng khám bệnh
   */
  @Get('examinations/by-time')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.TECHNICIAN)
  async getExaminationsByTime(
    @Query() query: TimeBasedQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ExaminationsByTimeResponseDto> {
    return this.statisticsService.getExaminationsByTime(query, user);
  }

  /**
   * GET /statistics/revenue/by-time
   * Thống kê doanh thu theo thời gian: cung cấp dữ liệu cho biểu đồ xu hướng doanh thu
   */
  @Get('revenue/by-time')
  @Roles(Role.ADMIN, Role.CASHIER)
  async getRevenueByTime(
    @Query() query: TimeBasedQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<RevenueByTimeResponseDto> {
    return this.statisticsService.getRevenueByTimeStats(query, user);
  }
}
