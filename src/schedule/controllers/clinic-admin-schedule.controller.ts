import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../login/jwt-auth.guard';
import { RolesGuard } from '../../rbac/roles.guard';
import { Roles } from '../../rbac/roles.decorator';
import { Role } from '../../rbac/roles.enum';
import { ScheduleService } from '../services/schedule.service';
import {
  ProcessScheduleRequestDto,
  QueryScheduleDto,
  QueryWorkingDaysDto,
  QueryScheduleRequestDto,
} from '../dto';

@ApiTags('Clinic Admin Schedule')
@Controller('clinics/:clinicId/schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ClinicAdminScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('monthly')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách đơn gửi lịch cố định của tất cả bác sĩ trong phòng khám' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách đơn gửi lịch cố định',
  })
  async getClinicSchedules(
    @Param('clinicId') clinicId: string,
    @Query() query: QueryScheduleDto,
  ) {
    return this.scheduleService.getClinicSchedules(clinicId, query);
  }

  @Get('working-days')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách ngày làm việc cụ thể của tất cả bác sĩ trong phòng khám' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách ngày làm việc cụ thể',
  })
  async getClinicWorkingDays(
    @Param('clinicId') clinicId: string,
    @Query() query: QueryWorkingDaysDto,
  ) {
    return this.scheduleService.getClinicWorkingDays(clinicId, query);
  }

  @Get('requests')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu thay đổi lịch của tất cả bác sĩ trong phòng khám' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách yêu cầu thay đổi lịch',
  })
  async getClinicScheduleRequests(
    @Param('clinicId') clinicId: string,
    @Query() query: QueryScheduleRequestDto,
  ) {
    return this.scheduleService.getClinicScheduleRequests(clinicId, query);
  }

  @Put('monthly/:submissionId/approve')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Duyệt đơn gửi lịch cố định hàng tháng' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đơn gửi lịch cố định đã được duyệt',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy đơn gửi lịch',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền duyệt lịch của phòng khám khác',
  })
  async approveMonthlySchedule(
    @Request() req: any,
    @Param('clinicId') clinicId: string,
    @Param('submissionId') submissionId: string,
  ) {
    const userId = req.user.id;
    return this.scheduleService.approveMonthlySchedule(submissionId, clinicId, userId);
  }

  @Put('monthly/:submissionId/reject')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Từ chối đơn gửi lịch cố định hàng tháng' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đơn gửi lịch cố định đã bị từ chối',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy đơn gửi lịch',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền từ chối lịch của phòng khám khác',
  })
  async rejectMonthlySchedule(
    @Request() req: any,
    @Param('clinicId') clinicId: string,
    @Param('submissionId') submissionId: string,
    @Body() body: { reason?: string },
  ) {
    const userId = req.user.id;
    return this.scheduleService.rejectMonthlySchedule(
      submissionId,
      clinicId,
      userId,
      body.reason,
    );
  }

  @Put('requests/:requestId/process')
  @Roles(Role.CLINIC_ADMIN)
  @ApiOperation({ summary: 'Xử lý yêu cầu thay đổi lịch' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Yêu cầu đã được xử lý',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy yêu cầu',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Có xung đột với lịch hẹn bệnh nhân',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền xử lý yêu cầu của phòng khám khác',
  })
  async processScheduleRequest(
    @Request() req: any,
    @Param('clinicId') clinicId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ProcessScheduleRequestDto,
  ) {
    const userId = req.user.id;
    return this.scheduleService.processScheduleRequest(
      requestId,
      clinicId,
      userId,
      dto,
    );
  }
}
