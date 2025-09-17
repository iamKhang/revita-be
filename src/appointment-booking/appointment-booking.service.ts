import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  SpecialtiesResponseDto,
  SpecialtyDoctorsResponseDto,
  AvailableDoctorsResponseDto,
  DoctorServicesResponseDto,
  AvailableSlotsResponseDto,
  AvailableSlotDto,
  AvailableDoctorDto,
  DoctorServiceDto,
  BookAppointmentDto,
  BookAppointmentResponseDto,
} from './dto';

interface AppointmentServiceData {
  serviceId: string;
  service: {
    timePerPatient: number | null;
  };
}

interface AppointmentData {
  startTime: string;
  endTime: string;
  appointmentServices: AppointmentServiceData[];
}

@Injectable()
export class AppointmentBookingService {
  private prisma = new PrismaClient();

  /**
   * Lấy danh sách tất cả chuyên khoa
   */
  async getSpecialties(): Promise<SpecialtiesResponseDto> {
    const specialties = await this.prisma.specialty.findMany({
      select: {
        id: true,
        specialtyCode: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      specialties: specialties.map((s) => ({
        specialtyId: s.id,
        specialtyCode: s.specialtyCode,
        name: s.name,
      })),
    };
  }

  /**
   * Lấy danh sách bác sĩ theo chuyên khoa
   */
  async getDoctorsBySpecialty(
    specialtyId: string,
  ): Promise<SpecialtyDoctorsResponseDto> {
    // Kiểm tra specialty có tồn tại không
    const specialty = await this.prisma.specialty.findUnique({
      where: { id: specialtyId },
    });

    if (!specialty) {
      throw new NotFoundException('Specialty not found');
    }

    // Lấy danh sách bác sĩ có work sessions trong tương lai
    const doctors = await this.prisma.doctor.findMany({
      where: {
        workSessions: {
          some: {
            startTime: {
              gte: new Date(), // Chỉ lấy work sessions trong tương lai
            },
            status: {
              in: ['APPROVED', 'IN_PROGRESS'], // Chỉ lấy work sessions đã được chấp nhận // Các trạng thái active
            },
          },
        },
      },
      include: {
        auth: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        rating: 'desc', // Sắp xếp theo rating cao nhất
      },
    });

    return {
      specialtyId: specialty.id,
      specialtyName: specialty.name,
      doctors: doctors.map((d) => ({
        doctorId: d.id,
        doctorCode: d.doctorCode,
        doctorName: d.auth.name,
        rating: d.rating,
        yearsExperience: d.yearsExperience,
        description: d.description,
      })),
    };
  }

  /**
   * Lấy danh sách bác sĩ có lịch làm việc trong ngày cụ thể theo chuyên khoa
   */
  async getAvailableDoctors(
    specialtyId: string,
    date: string,
  ): Promise<AvailableDoctorsResponseDto> {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Kiểm tra specialty có tồn tại không
    const specialty = await this.prisma.specialty.findUnique({
      where: { id: specialtyId },
    });

    if (!specialty) {
      throw new NotFoundException('Specialty not found');
    }

    // Lấy work sessions của bác sĩ trong ngày đó
    const workSessions = await this.prisma.workSession.findMany({
      where: {
        doctorId: {
          not: null, // Chỉ lấy work sessions của doctor
        },
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['APPROVED', 'IN_PROGRESS'], // Chỉ lấy work sessions đã được chấp nhận
        },
      },
      include: {
        doctor: {
          include: {
            auth: {
              select: {
                name: true,
              },
            },
          },
        },
        booth: {
          include: {
            room: {
              select: {
                roomName: true,
              },
            },
          },
        },
      },
    });

    // Group by doctor và lấy thông tin work session đầu tiên
    const doctorMap = new Map();

    workSessions.forEach((ws) => {
      if (ws.doctor && !doctorMap.has(ws.doctor.id)) {
        doctorMap.set(ws.doctor.id, {
          doctorId: ws.doctor.id,
          doctorCode: ws.doctor.doctorCode,
          doctorName: ws.doctor.auth.name,
          specialtyId: specialty.id,
          specialtyName: specialty.name,
          rating: ws.doctor.rating,
          workSessionStart: ws.startTime.toISOString(),
          workSessionEnd: ws.endTime.toISOString(),
          boothId: ws.booth?.id,
          boothName: ws.booth?.name,
          roomName: ws.booth?.room?.roomName,
        });
      }
    });

    return {
      specialtyId: specialty.id,
      specialtyName: specialty.name,
      date: targetDate.toISOString().split('T')[0],
      doctors: Array.from(doctorMap.values()) as AvailableDoctorDto[],
    };
  }

  /**
   * Lấy danh sách dịch vụ mà bác sĩ làm trong ngày cụ thể
   */
  async getDoctorServices(
    doctorId: string,
    date: string,
  ): Promise<DoctorServicesResponseDto> {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Kiểm tra doctor có tồn tại không
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        auth: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Lấy work sessions của bác sĩ bao gồm cả work sessions kéo dài qua đêm
    const workSessions = await this.prisma.workSession.findMany({
      where: {
        doctorId: doctorId,
        OR: [
          // Work sessions bắt đầu trong ngày query
          {
            startTime: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          // Work sessions kết thúc trong ngày query (kéo dài từ ngày trước)
          {
            endTime: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          // Work sessions bao phủ toàn bộ ngày query
          {
            AND: [
              { startTime: { lte: startOfDay } },
              { endTime: { gte: endOfDay } },
            ],
          },
        ],
        status: {
          in: ['APPROVED', 'IN_PROGRESS'], // Chỉ lấy work sessions đã được chấp nhận
        },
      },
      include: {
        services: {
          include: {
            service: true,
          },
        },
      },
    });

    // Thu thập tất cả services từ work sessions
    const serviceMap = new Map();

    workSessions.forEach((ws) => {
      ws.services.forEach((wss) => {
        if (!serviceMap.has(wss.service.id)) {
          serviceMap.set(wss.service.id, {
            serviceId: wss.service.id,
            serviceName: wss.service.name,
            serviceCode: wss.service.serviceCode,
            price: wss.service.price || undefined,
            timePerPatient: wss.service.timePerPatient ?? 15, // default 15 phút
            description: wss.service.description,
          });
        }
      });
    });

    return {
      doctorId: doctor.id,
      doctorName: doctor.auth.name,
      date: targetDate.toISOString().split('T')[0],
      services: Array.from(serviceMap.values()) as DoctorServiceDto[],
    };
  }

  /**
   * Tính toán các slot trống của bác sĩ cho service cụ thể trong ngày
   */
  async getAvailableSlots(
    doctorId: string,
    serviceId: string,
    date: string,
  ): Promise<AvailableSlotsResponseDto> {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Kiểm tra doctor và service có tồn tại không
    const [doctor, service] = await Promise.all([
      this.prisma.doctor.findUnique({
        where: { id: doctorId },
        include: {
          auth: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.service.findUnique({
        where: { id: serviceId },
      }),
    ]);

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Lấy work sessions của bác sĩ bao gồm cả work sessions kéo dài qua đêm
    const workSessions = await this.prisma.workSession.findMany({
      where: {
        doctorId: doctorId,
        OR: [
          // Work sessions bắt đầu trong ngày query
          {
            startTime: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          // Work sessions kết thúc trong ngày query (kéo dài từ ngày trước)
          {
            endTime: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          // Work sessions bao phủ toàn bộ ngày query
          {
            AND: [
              { startTime: { lte: startOfDay } },
              { endTime: { gte: endOfDay } },
            ],
          },
        ],
        status: {
          in: ['APPROVED', 'IN_PROGRESS'], // Chỉ lấy work sessions đã được chấp nhận
        },
      },
      include: {
        services: {
          where: {
            serviceId: serviceId,
          },
        },
      },
      orderBy: {
        startTime: 'asc', // Sắp xếp theo thời gian bắt đầu để lấy work session sớm nhất
      },
    });

    // Nếu bác sĩ không có work session nào trong ngày hoặc không làm service này
    if (
      workSessions.length === 0 ||
      !workSessions.some((ws) => ws.services.length > 0)
    ) {
      console.log('DEBUG: No valid work sessions found for doctor', doctorId, 'and service', serviceId);
      return {
        doctorId: doctor.id,
        doctorName: doctor.auth.name,
        serviceId: service.id,
        serviceName: service.name,
        date: targetDate.toISOString().split('T')[0],
        workSessionStart: '',
        workSessionEnd: '',
        slots: [],
      };
    }

    // Lấy work session đầu tiên (giả sử bác sĩ chỉ có 1 work session trong ngày)
    const workSession = workSessions[0];
    const workSessionStart = new Date(workSession.startTime);
    const workSessionEnd = new Date(workSession.endTime);
    const serviceDuration = service.timePerPatient ?? 15; // phút

    // Lấy tất cả appointments của bác sĩ trong ngày
    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId: doctorId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        appointmentServices: {
          include: {
            service: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });


    // Tính toán các slot trống
    const slots = this.calculateAvailableSlots(
      workSessionStart,
      workSessionEnd,
      appointments as unknown as AppointmentData[],
      serviceDuration,
      serviceId,
      targetDate,
    );

    // Tính toán work session start/end trong ngày query
    const queryDayStart = new Date(targetDate);
    queryDayStart.setHours(0, 0, 0, 0);
    const queryDayEnd = new Date(targetDate);
    queryDayEnd.setHours(23, 59, 59, 999);

    const effectiveStart = workSessionStart > queryDayStart ? workSessionStart : queryDayStart;
    const effectiveEnd = workSessionEnd < queryDayEnd ? workSessionEnd : queryDayEnd;

    return {
      doctorId: doctor.id,
      doctorName: doctor.auth.name,
      serviceId: service.id,
      serviceName: service.name,
      date: targetDate.toISOString().split('T')[0],
      workSessionStart: effectiveStart.toISOString(),
      workSessionEnd: effectiveEnd.toISOString(),
      slots,
    };
  }

  /**
   * Tính toán các slot trống dựa trên work session và appointments hiện có
   */
  private calculateAvailableSlots(
    workSessionStart: Date,
    workSessionEnd: Date,
    appointments: AppointmentData[],
    serviceDuration: number,
    targetServiceId: string,
    queryDate: Date,
  ): AvailableSlotDto[] {
    const slots: AvailableSlotDto[] = [];

    // Nếu ngày hôm nay và work session đã kết thúc, không cho đặt lịch
    const now = new Date();
    const isToday = workSessionStart.toDateString() === now.toDateString();
    if (isToday && workSessionEnd <= now) {
      return slots; // Work session đã kết thúc, không cho đặt lịch
    }

    let currentTime = new Date(workSessionStart);

    // Duyệt qua từng slot trong work session
    while (currentTime < workSessionEnd) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(currentTime.getTime() + serviceDuration * 60000);

      // Đảm bảo slot không vượt quá work session end
      if (slotEnd > workSessionEnd) {
        break; // Không tạo slot nếu vượt quá thời gian work session
      }

      // Chỉ tạo slots hoàn toàn thuộc về ngày được query (cả start và end)
      if (slotStart.toDateString() !== queryDate.toDateString() ||
          slotEnd.toDateString() !== queryDate.toDateString()) {
        currentTime = new Date(currentTime.getTime() + serviceDuration * 60000);
        continue; // Bỏ qua slots không hoàn toàn thuộc ngày query
      }

      // Kiểm tra slot này có khả dụng không
      const isAvailable = this.isSlotAvailable(
        slotStart,
        slotEnd,
        appointments,
        targetServiceId,
      );

      slots.push({
        startTime: slotStart.toTimeString().slice(0, 5), // HH:MM format
        endTime: slotEnd.toTimeString().slice(0, 5),
        isAvailable,
        reason: isAvailable ? undefined : 'busy_or_not_enough_time',
      });

      // Tăng currentTime lên 15 phút (interval giữa các slot)
      currentTime = new Date(currentTime.getTime() + 15 * 60000);
    }

    return slots;
  }

  /**
   * Kiểm tra một slot có khả dụng không
   */
  private isSlotAvailable(
    slotStart: Date,
    slotEnd: Date,
    appointments: AppointmentData[],
    targetServiceId: string,
  ): boolean {
    for (const appointment of appointments) {
      // Parse appointment time trong cùng ngày với slot
      const appointmentStart = new Date(slotStart);
      appointmentStart.setHours(
        parseInt(appointment.startTime.split(':')[0]),
        parseInt(appointment.startTime.split(':')[1]),
        0, 0
      );

      const appointmentEnd = new Date(slotStart);
      appointmentEnd.setHours(
        parseInt(appointment.endTime.split(':')[0]),
        parseInt(appointment.endTime.split(':')[1]),
        0, 0
      );

      // Check conflict với tất cả appointments của bác sĩ trong ngày
      // Nếu slot overlap với bất kỳ appointment nào (không phân biệt service)
      if (slotStart < appointmentEnd && slotEnd > appointmentStart) {
        return false;
      }
    }

    return true;
  }

  /**
   * Đặt lịch khám bệnh
   */
  async bookAppointment(
    bookAppointmentDto: BookAppointmentDto,
    bookerId: string,
  ): Promise<BookAppointmentResponseDto> {
    const {
      patientProfileId,
      doctorId,
      serviceId,
      date,
      startTime,
      endTime,
    } = bookAppointmentDto;

    // Validate inputs
    if (!bookerId || !patientProfileId || !doctorId || !serviceId || !date || !startTime || !endTime) {
      throw new Error('Missing required fields');
    }

    // Check if patient profile exists
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      include: { patient: true },
    });

    if (!patientProfile) {
      throw new NotFoundException('Patient profile not found');
    }

    // Check if doctor exists
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { auth: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Check if service exists
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Check if booker exists
    const booker = await this.prisma.auth.findUnique({
      where: { id: bookerId },
    });

    if (!booker) {
      throw new NotFoundException('Booker not found');
    }

    // Validate time slot is available
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get work sessions for this doctor and date
    const workSessions = await this.prisma.workSession.findMany({
      where: {
        doctorId: doctorId,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['APPROVED', 'IN_PROGRESS'],
        },
      },
      include: {
        services: {
          where: {
            serviceId: serviceId,
          },
        },
      },
    });

    if (workSessions.length === 0 || !workSessions.some(ws => ws.services.length > 0)) {
      throw new Error('No available work session for this doctor and service on the selected date');
    }

    // Check if the requested time slot conflicts with existing appointments
    const appointmentStart = this.parseAppointmentTime(date, startTime);
    const appointmentEnd = this.parseAppointmentTime(date, endTime);

    const conflictingAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId: doctorId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Check for time conflicts manually
    const hasConflict = conflictingAppointments.some(apt => {
      const aptStart = this.parseAppointmentTime(apt.date.toISOString().split('T')[0], apt.startTime);
      const aptEnd = this.parseAppointmentTime(apt.date.toISOString().split('T')[0], apt.endTime);
      return !(appointmentEnd <= aptStart || appointmentStart >= aptEnd);
    });

    if (hasConflict) {
      throw new Error('Time slot is not available');
    }

    // Generate appointment code
    const appointmentCode = `APT-${Date.now()}`;

    // Get specialty from work session
    const workSession = workSessions[0];
    const booth = await this.prisma.booth.findUnique({
      where: { id: workSession.boothId! },
      include: { room: true },
    });

    if (!booth?.room?.specialtyId) {
      throw new Error('Specialty not found for work session');
    }

    // Create appointment
    const appointment = await this.prisma.appointment.create({
      data: {
        appointmentCode,
        patientProfileId,
        specialtyId: booth.room.specialtyId,
        doctorId,
        serviceId,
        bookerId,
        date: targetDate,
        startTime,
        endTime,
        status: 'PENDING',
        appointmentServices: {
          create: {
            serviceId: serviceId,
          },
        },
      },
      include: {
        patientProfile: {
          include: {
            patient: true,
          },
        },
        doctor: {
          include: {
            auth: true,
          },
        },
        service: true,
        appointmentServices: {
          include: {
            service: true,
          },
        },
      },
    });

    return {
      appointmentId: appointment.id,
      appointmentCode: appointment.appointmentCode,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctor.auth.name,
      patientProfileId: appointment.patientProfileId,
      patientName: appointment.patientProfile.name,
      serviceId: appointment.serviceId || '',
      serviceName: appointment.service?.name || '',
      date: appointment.date.toISOString().split('T')[0],
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Parse appointment time từ date và time string
   */
  private parseAppointmentTime(dateStr: string, timeStr: string): Date {
    const date = new Date(dateStr);
    const [hours, minutes] = timeStr.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

}
