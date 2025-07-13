import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../login/jwt-auth.guard';
import { RolesGuard } from '../../rbac/roles.guard';
import { Roles } from '../../rbac/roles.decorator';
import { Role } from '../../rbac/roles.enum';
import { ScheduleService } from '../services/schedule.service';
import {
  CreateMonthlyScheduleDto,
  CreateScheduleRequestDto,
  QueryScheduleDto,
  QueryWorkingDaysDto,
  QueryScheduleRequestDto,
} from '../dto';

@ApiTags('Doctor Schedule')
@Controller('doctors/:doctorId/schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class DoctorScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('monthly')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Gửi lịch cố định hàng tháng' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Lịch cố định đã được tạo thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ hoặc đã tồn tại lịch cho tháng này',
  })
  async createMonthlySchedule(
    @Param('doctorId') doctorId: string,
    @Body() dto: CreateMonthlyScheduleDto,
  ) {
    return this.scheduleService.createMonthlySchedule(doctorId, dto);
  }

  @Post('request')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Tạo yêu cầu thay đổi lịch đột xuất' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Yêu cầu thay đổi lịch đã được tạo thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ',
  })
  async createScheduleRequest(
    @Param('doctorId') doctorId: string,
    @Body() dto: CreateScheduleRequestDto,
  ) {
    return this.scheduleService.createScheduleRequest(doctorId, dto);
  }

  @Get('monthly')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Lấy danh sách đơn gửi lịch cố định của bác sĩ' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách đơn gửi lịch cố định',
  })
  async getMySchedules(
    @Param('doctorId') doctorId: string,
    @Query() query: QueryScheduleDto,
  ) {
    return this.scheduleService.getDoctorSchedules(doctorId, query);
  }

  @Get('working-days')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Lấy danh sách ngày làm việc cụ thể của bác sĩ' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách ngày làm việc cụ thể',
  })
  async getMyWorkingDays(
    @Param('doctorId') doctorId: string,
    @Query() query: QueryWorkingDaysDto,
  ) {
    return this.scheduleService.getDoctorWorkingDays(doctorId, query);
  }

  @Get('requests')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu thay đổi lịch của bác sĩ' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách yêu cầu thay đổi lịch',
  })
  async getMyScheduleRequests(
    @Param('doctorId') doctorId: string,
    @Query() query: QueryScheduleRequestDto,
  ) {
    return this.scheduleService.getScheduleRequests(doctorId, query);
  }
}
