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
import { Public } from '../rbac/public.decorator';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { BookAppointmentDto } from './dto';

@Controller('appointment-booking')
export class AppointmentBookingController {
  constructor(
    private readonly appointmentBookingService: AppointmentBookingService,
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
