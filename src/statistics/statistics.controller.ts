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
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
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
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
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
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
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
}
