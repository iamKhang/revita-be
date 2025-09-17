import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Post,
  Body,
  Req,
} from '@nestjs/common';
import { AppointmentBookingService } from './appointment-booking.service';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../rbac/public.decorator';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { BookAppointmentDto } from './dto';

@Controller('appointment-booking')
export class AppointmentBookingController {
  constructor(
    private readonly appointmentBookingService: AppointmentBookingService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Test endpoint
   * GET /appointment-booking/test
   */
  @Get('test')
  @Public()
  async test() {
    return { message: 'Appointment booking module is working!' };
  }

  /**
   * Lấy danh sách tất cả chuyên khoa
   * GET /appointment-booking/specialties
   */
  @Get('specialties')
  @Public() // Cho phép truy cập công khai
  async getSpecialties() {
    return this.appointmentBookingService.getSpecialties();
  }

  /**
   * Lấy danh sách bác sĩ theo chuyên khoa
   * GET /appointment-booking/specialties/:specialtyId/doctors
   */
  @Get('specialties/:specialtyId/doctors')
  @Public() // Cho phép truy cập công khai
  async getDoctorsBySpecialty(@Param('specialtyId') specialtyId: string) {
    if (!specialtyId) {
      throw new BadRequestException('Specialty ID is required');
    }
    return this.appointmentBookingService.getDoctorsBySpecialty(specialtyId);
  }

  /**
   * Lấy danh sách bác sĩ có lịch làm việc trong ngày cụ thể theo chuyên khoa
   * GET /appointment-booking/doctors/available?specialtyId=X&date=Y
   */
  @Get('doctors/available')
  @Public() // Cho phép truy cập công khai
  async getAvailableDoctors(
    @Query('specialtyId') specialtyId: string,
    @Query('date') date: string,
  ) {
    if (!specialtyId) {
      throw new BadRequestException('Specialty ID is required');
    }
    if (!date) {
      throw new BadRequestException('Date is required');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    return this.appointmentBookingService.getAvailableDoctors(
      specialtyId,
      date,
    );
  }

  /**
   * Lấy danh sách dịch vụ mà bác sĩ làm trong ngày cụ thể
   * GET /appointment-booking/doctors/:doctorId/services?date=X
   */
  @Get('doctors/:doctorId/services')
  @Public() // Cho phép truy cập công khai
  async getDoctorServices(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    if (!doctorId) {
      throw new BadRequestException('Doctor ID is required');
    }
    if (!date) {
      throw new BadRequestException('Date is required');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    return this.appointmentBookingService.getDoctorServices(doctorId, date);
  }

  /**
   * Lấy danh sách lịch trống của bác sĩ cho service cụ thể trong ngày
   * GET /appointment-booking/doctors/:doctorId/available-slots?serviceId=X&date=Y
   */
  @Get('doctors/:doctorId/available-slots')
  @Public() // Cho phép truy cập công khai
  async getAvailableSlots(
    @Param('doctorId') doctorId: string,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
  ) {
    if (!doctorId) {
      throw new BadRequestException('Doctor ID is required');
    }
    if (!serviceId) {
      throw new BadRequestException('Service ID is required');
    }
    if (!date) {
      throw new BadRequestException('Date is required');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    return this.appointmentBookingService.getAvailableSlots(
      doctorId,
      serviceId,
      date,
    );
  }

  /**
   * Lấy danh sách các ngày làm việc của bác sĩ trong tháng
   * GET /appointment-booking/doctors/:doctorId/working-days?month=X
   */
  @Get('doctors/:doctorId/working-days')
  @Public() // Cho phép truy cập công khai
  async getDoctorWorkingDays(
    @Param('doctorId') doctorId: string,
    @Query('month') month: string,
  ) {
    if (!doctorId) {
      throw new BadRequestException('Doctor ID is required');
    }
    if (!month) {
      throw new BadRequestException('Month is required');
    }

    // Validate month format (MM/YYYY)
    const monthRegex = /^\d{2}\/\d{4}$/;
    if (!monthRegex.test(month)) {
      throw new BadRequestException('Month must be in MM/YYYY format');
    }

    return this.appointmentBookingService.getDoctorWorkingDays(doctorId, month);
  }

  /**
   * Debug: Lấy danh sách work sessions của bác sĩ trong tháng
   * GET /appointment-booking/doctors/:doctorId/work-sessions?month=X
   */
  @Get('doctors/:doctorId/work-sessions')
  @Public() // Cho phép truy cập công khai
  async getDoctorWorkSessions(
    @Param('doctorId') doctorId: string,
    @Query('month') month: string,
  ) {
    if (!doctorId) {
      throw new BadRequestException('Doctor ID is required');
    }
    if (!month) {
      throw new BadRequestException('Month is required');
    }

    // Validate month format (MM/YYYY)
    const monthRegex = /^\d{2}\/\d{4}$/;
    if (!monthRegex.test(month)) {
      throw new BadRequestException('Month must be in MM/YYYY format');
    }

    const [monthStr, yearStr] = month.split('/');
    const monthNum = parseInt(monthStr, 10);
    const yearNum = parseInt(yearStr, 10);

    // Tạo khoảng thời gian cho tháng (sử dụng UTC)
    const startOfMonth = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));

    // Lấy tất cả work sessions của bác sĩ trong tháng
    const workSessions = await this.prisma.workSession.findMany({
      where: {
        doctorId: doctorId,
        OR: [
          // Work sessions bắt đầu trong tháng
          {
            startTime: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          // Work sessions kết thúc trong tháng (kéo dài từ tháng trước)
          {
            endTime: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          // Work sessions bao phủ toàn bộ tháng
          {
            AND: [
              { startTime: { lte: startOfMonth } },
              { endTime: { gte: endOfMonth } },
            ],
          },
        ],
        status: {
          in: ['APPROVED', 'IN_PROGRESS'],
        },
      },
    });

    return {
      doctorId,
      month,
      startOfMonth: startOfMonth.toISOString(),
      endOfMonth: endOfMonth.toISOString(),
      workSessions: workSessions.map(ws => ({
        id: ws.id,
        startTime: ws.startTime,
        endTime: ws.endTime,
        status: ws.status,
        startDate: new Date(ws.startTime).toISOString().split('T')[0],
        endDate: new Date(ws.endTime).toISOString().split('T')[0],
      })),
    };
  }

  /**
   * Lấy danh sách tất cả lịch hẹn của patient hiện tại
   * GET /appointment-booking/patient/appointments
   */
  @Get('patient/appointments')
  @UseGuards(JwtAuthGuard) // Cần authentication để lấy thông tin patient
  async getPatientAppointments(@Req() req: any) {
    const patientId = req.user.id; // Lấy patient ID từ JWT token
    return this.appointmentBookingService.getPatientAppointments(patientId);
  }

  /**
   * Đặt lịch khám bệnh
   * POST /appointment-booking/appointments
   */
  @Post('appointments')
  @UseGuards(JwtAuthGuard)
  async bookAppointment(
    @Body() bookAppointmentDto: BookAppointmentDto,
    @Req() req: any,
  ) {
    const bookerId = req.user.id; // Lấy user ID từ JWT token
    return this.appointmentBookingService.bookAppointment(bookAppointmentDto, bookerId);
  }
}
