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
  DoctorWorkingDaysDto,
  PatientAppointmentsResponseDto,
  PatientAppointmentDto,
  PatientAppointmentServiceDto,
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
    // Parse date using UTC để tránh timezone issues
    const dateParts = date.split('-').map(Number);
    const targetDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0, 0, 0));

    // Tạo startOfDay và endOfDay sử dụng UTC
    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 23, 59, 59, 999));

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

    // Debug: Log query parameters
    console.log('DEBUG: Querying work sessions for date:', targetDate.toISOString().split('T')[0]);
    console.log('DEBUG: startOfDay (UTC):', startOfDay.toISOString());
    console.log('DEBUG: endOfDay (UTC):', endOfDay.toISOString());

    // Debug: Log work sessions found
    console.log('DEBUG: Found', workSessions.length, 'work sessions for doctor', doctorId, 'on date', targetDate.toISOString().split('T')[0]);
    workSessions.forEach((ws, index) => {
      console.log(`Work session ${index}:`, {
        id: ws.id,
        startTime: ws.startTime.toISOString(),
        endTime: ws.endTime.toISOString(),
        status: ws.status,
        hasService: ws.services.length > 0,
        services: ws.services.map(s => s.serviceId)
      });
    });

    // Lọc work sessions có chứa service được yêu cầu
    const validWorkSessions = workSessions.filter(ws => ws.services.length > 0);

    if (validWorkSessions.length === 0) {
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

    const serviceDuration = service.timePerPatient ?? 15; // phút

    // Lấy tất cả appointments của bác sĩ trong ngày (sử dụng UTC dates)
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

    console.log('DEBUG: Found', appointments.length, 'existing appointments for doctor', doctorId, 'on date', targetDate.toISOString().split('T')[0]);
    appointments.forEach((apt, index) => {
      console.log(`Appointment ${index}:`, {
        id: apt.id,
        date: apt.date.toISOString(),
        startTime: apt.startTime,
        endTime: apt.endTime,
        serviceId: apt.serviceId,
        appointmentServices: apt.appointmentServices.map(as => as.serviceId)
      });
    });

    // Tạo slots từ tất cả work sessions trong ngày
    // Merge tất cả work sessions thành một danh sách slots duy nhất
    const allSlots: AvailableSlotDto[] = [];

    console.log('DEBUG: Processing', validWorkSessions.length, 'valid work sessions');
    console.log('DEBUG: Service duration:', serviceDuration, 'minutes');

    for (const workSession of validWorkSessions) {
      const workSessionStart = new Date(workSession.startTime);
      const workSessionEnd = new Date(workSession.endTime);

      console.log('DEBUG: Processing work session:', {
        id: workSession.id,
        startTime: workSessionStart.toISOString(),
        endTime: workSessionEnd.toISOString(),
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString()
      });

      // Chỉ tạo slots trong ngày query
      const effectiveStart = workSessionStart > startOfDay ? workSessionStart : startOfDay;
      const effectiveEnd = workSessionEnd < endOfDay ? workSessionEnd : endOfDay;

      console.log('DEBUG: Effective time range:', {
        effectiveStart: effectiveStart.toISOString(),
        effectiveEnd: effectiveEnd.toISOString(),
        isValid: effectiveStart < effectiveEnd
      });

      if (effectiveStart >= effectiveEnd) {
        console.log('DEBUG: Skipping work session - no valid time range in query date');
        continue; // Không có thời gian hợp lệ trong ngày
      }

      let currentTime = new Date(effectiveStart);
      let slotsCreated = 0;

      // Tạo slots cho work session này
      while (currentTime < effectiveEnd) {
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(currentTime.getTime() + serviceDuration * 60000);

        // Đảm bảo slot không vượt quá work session end
        if (slotEnd > effectiveEnd) {
          console.log('DEBUG: Slot would exceed work session end, breaking');
          break;
        }

        // Kiểm tra slot này có khả dụng không
        const isAvailable = this.isSlotAvailable(
          slotStart,
          slotEnd,
          appointments as unknown as AppointmentData[],
          serviceId,
        );

        // Format time as HH:mm (giữ nguyên giờ local, không convert UTC)
        const startTimeStr = slotStart.getUTCHours().toString().padStart(2, '0') + ':' +
                             slotStart.getUTCMinutes().toString().padStart(2, '0');
        const endTimeStr = slotEnd.getUTCHours().toString().padStart(2, '0') + ':' +
                           slotEnd.getUTCMinutes().toString().padStart(2, '0');

        // Debug: Log slot checking for 14:00 slots
        if (startTimeStr === '14:00' || startTimeStr === '14:05' || startTimeStr === '14:10' || startTimeStr === '14:15') {
          console.log('DEBUG: Checking slot', startTimeStr, '-', endTimeStr, 'isAvailable:', isAvailable);
        }

        allSlots.push({
          startTime: startTimeStr,
          endTime: endTimeStr,
          isAvailable,
        });

        slotsCreated++;

        // Tăng currentTime lên serviceDuration để tạo slot tiếp theo
        // Điều này đảm bảo slots liên tiếp nhau mà không có khoảng trống
        currentTime = new Date(currentTime.getTime() + serviceDuration * 60000);

        console.log('DEBUG: Next slot will start at:', currentTime.toISOString());
      }

      console.log('DEBUG: Created', slotsCreated, 'slots for work session', workSession.id);
    }

    // Sort slots theo thời gian
    allSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    console.log('DEBUG: Generated slots count:', allSlots.length);

    // Tính toán effective work session start và end từ tất cả valid work sessions
    let overallStart: Date | null = null;
    let overallEnd: Date | null = null;

    for (const ws of validWorkSessions) {
      const effectiveStart = ws.startTime > startOfDay ? ws.startTime : startOfDay;
      const effectiveEnd = ws.endTime < endOfDay ? ws.endTime : endOfDay;

      if (effectiveStart < effectiveEnd) {
        if (!overallStart || effectiveStart < overallStart) {
          overallStart = effectiveStart;
        }
        if (!overallEnd || effectiveEnd > overallEnd) {
          overallEnd = effectiveEnd;
        }
      }
    }

    console.log('DEBUG: Overall work session range:', {
      overallStart: overallStart?.toISOString(),
      overallEnd: overallEnd?.toISOString()
    });

    return {
      doctorId: doctor.id,
      doctorName: doctor.auth.name,
      serviceId: service.id,
      serviceName: service.name,
      date: targetDate.toISOString().split('T')[0],
      workSessionStart: overallStart ? overallStart.toISOString() : '',
      workSessionEnd: overallEnd ? overallEnd.toISOString() : '',
      slots: allSlots,
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
    console.log('DEBUG: Checking slot availability for', slotStart.toISOString(), '-', slotEnd.toISOString());

    for (const appointment of appointments) {
      // Parse appointment time using UTC to match database storage
      const appointmentStart = this.parseAppointmentTimeFromSlot(slotStart, appointment.startTime);
      const appointmentEnd = this.parseAppointmentTimeFromSlot(slotStart, appointment.endTime);

      console.log('DEBUG: Comparing with appointment:', {
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        appointmentStart: appointmentStart.toISOString(),
        appointmentEnd: appointmentEnd.toISOString(),
        slotStart: slotStart.toISOString(),
        slotEnd: slotEnd.toISOString(),
        overlap: (slotStart < appointmentEnd && slotEnd > appointmentStart)
      });

      // Check conflict với tất cả appointments của bác sĩ trong ngày
      // Nếu slot overlap với bất kỳ appointment nào (không phân biệt service)
      if (slotStart < appointmentEnd && slotEnd > appointmentStart) {
        console.log('DEBUG: Slot conflicts with appointment (startTime:', appointment.startTime, ')');
        return false;
      }
    }

    console.log('DEBUG: Slot is available');
    return true;
  }

  /**
   * Parse appointment time từ slot date và time string (sử dụng UTC)
   */
  private parseAppointmentTimeFromSlot(slotDate: Date, timeStr: string): Date {
    const [year, month, day] = [slotDate.getUTCFullYear(), slotDate.getUTCMonth(), slotDate.getUTCDate()];
    const [hours, minutes] = timeStr.split(':').map(Number);
    // Create Date object in UTC to match database storage
    return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
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

    // Validate time slot is available (using UTC dates like getAvailableSlots)
    const dateParts = date.split('-').map(Number);
    const targetDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0, 0, 0));
    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], 23, 59, 59, 999));

    // Get work sessions for this doctor and date (bao gồm cả work sessions kéo dài từ ngày trước)
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
          in: ['APPROVED', 'IN_PROGRESS'],
        },
      },
      include: {
        services: {
          where: {
            serviceId: serviceId,
          },
        },
        booth: {
          include: {
            room: true,
          },
        },
      },
    });

    console.log('DEBUG: Found work sessions for booking:', workSessions.length);
    workSessions.forEach((ws, index) => {
      console.log(`Work session ${index}:`, {
        id: ws.id,
        startTime: ws.startTime.toISOString(),
        endTime: ws.endTime.toISOString(),
        status: ws.status,
        hasService: ws.services.length > 0,
        serviceIds: ws.services.map(s => s.serviceId)
      });
    });

    if (workSessions.length === 0 || !workSessions.some(ws => ws.services.length > 0)) {
      throw new Error('No available work session for this doctor and service on the selected date');
    }

    // Check if the requested time slot conflicts with existing appointments
    const requestedStart = this.parseAppointmentTime(date, startTime);
    const requestedEnd = this.parseAppointmentTime(date, endTime);

    console.log('DEBUG: Requested slot times:', {
      date,
      startTime,
      endTime,
      requestedStart: requestedStart.toISOString(),
      requestedEnd: requestedEnd.toISOString()
    });

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
      return !(requestedEnd <= aptStart || requestedStart >= aptEnd);
    });

    if (hasConflict) {
      throw new Error('Time slot is not available');
    }

    // Generate appointment code
    const appointmentCode = `APT-${Date.now()}`;

    // Tìm work session chứa slot được chọn (trong effective time range trong ngày)
    console.log('DEBUG: Looking for suitable work session for slot:', {
      requestedStart: requestedStart.toISOString(),
      requestedEnd: requestedEnd.toISOString()
    });

    const suitableWorkSession = workSessions.find(ws => {
      const wsStart = new Date(ws.startTime);
      const wsEnd = new Date(ws.endTime);

      // Tính effective time range trong ngày query
      const effectiveStart = wsStart > startOfDay ? wsStart : startOfDay;
      const effectiveEnd = wsEnd < endOfDay ? wsEnd : endOfDay;

      const isSuitable = effectiveStart <= requestedStart && effectiveEnd >= requestedEnd && ws.services.length > 0;

      console.log('DEBUG: Checking work session:', {
        wsId: ws.id,
        wsStart: wsStart.toISOString(),
        wsEnd: wsEnd.toISOString(),
        effectiveStart: effectiveStart.toISOString(),
        effectiveEnd: effectiveEnd.toISOString(),
        hasService: ws.services.length > 0,
        isSuitable
      });

      return isSuitable;
    });

    console.log('DEBUG: Found suitable work session:', suitableWorkSession?.id || 'NONE');

    if (!suitableWorkSession) {
      throw new Error('No suitable work session found for the selected time slot');
    }

    // Get specialty from work session (through booth -> room)
    if (!suitableWorkSession.booth?.room?.specialtyId) {
      throw new Error('Specialty not found for work session');
    }

    // Create appointment
    const appointment = await this.prisma.appointment.create({
      data: {
        appointmentCode,
        patientProfileId,
        specialtyId: suitableWorkSession.booth.room.specialtyId,
        doctorId,
        serviceId,
        bookerId,
        workSessionId: suitableWorkSession.id, // Set work session ID
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
   * Lấy danh sách các ngày làm việc của bác sĩ trong tháng
   */
  async getDoctorWorkingDays(
    doctorId: string,
    month: string,
  ): Promise<DoctorWorkingDaysDto> {
    // Parse month string (format: "MM/YYYY")
    const [monthStr, yearStr] = month.split('/');
    const monthNum = parseInt(monthStr, 10);
    const yearNum = parseInt(yearStr, 10);

    if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
      throw new Error('Invalid month format. Use MM/YYYY format');
    }

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

    // Tạo khoảng thời gian cho tháng (sử dụng UTC để tránh vấn đề timezone)
    const startOfMonth = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0)); // Tháng trong JS bắt đầu từ 0
    const endOfMonth = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999)); // Ngày cuối tháng

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
          in: ['APPROVED', 'IN_PROGRESS'], // Chỉ lấy work sessions đã được chấp nhận
        },
      },
    });

    // Debug: Log work sessions found
    console.log('DEBUG: Found work sessions for doctor', doctorId, 'in month', month);
    workSessions.forEach((ws, index) => {
      console.log(`Work session ${index}:`, {
        id: ws.id,
        startTime: ws.startTime,
        endTime: ws.endTime,
        status: ws.status
      });
    });

    // Thu thập các ngày duy nhất từ work sessions
    const workingDaysSet = new Set<string>();

    workSessions.forEach((ws) => {
      const startDate = new Date(ws.startTime);
      const endDate = new Date(ws.endTime);

      // Thêm ngày của startTime (sử dụng UTC)
      const startDateNormalized = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
      if (startDateNormalized >= startOfMonth && startDateNormalized <= endOfMonth) {
        workingDaysSet.add(startDateNormalized.toISOString().split('T')[0]);
      }

      // Nếu work session kéo dài sang ngày khác, thêm ngày của endTime
      const endDateNormalized = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
      if (endDateNormalized.getTime() !== startDateNormalized.getTime() && endDateNormalized >= startOfMonth && endDateNormalized <= endOfMonth) {
        workingDaysSet.add(endDateNormalized.toISOString().split('T')[0]);
      }

      // Nếu work session kéo dài nhiều ngày, thêm tất cả các ngày trong khoảng
      if (startDateNormalized.getTime() !== endDateNormalized.getTime()) {
        let currentDate = new Date(startDateNormalized);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Bắt đầu từ ngày sau startDate

        while (currentDate < endDateNormalized) {
          if (currentDate >= startOfMonth && currentDate <= endOfMonth) {
            workingDaysSet.add(currentDate.toISOString().split('T')[0]);
          }
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
      }
    });

    // Chuyển Set thành array và sort
    const workingDays = Array.from(workingDaysSet).sort();

    console.log('DEBUG: Final working days:', workingDays);

    return {
      doctorId: doctor.id,
      doctorName: doctor.auth.name,
      month: month,
      workingDays: workingDays,
    };
  }

  /**
   * Lấy danh sách tất cả lịch hẹn của patient
   */
  async getPatientAppointments(patientId: string): Promise<PatientAppointmentsResponseDto> {
    // Kiểm tra patient có tồn tại không (patientId chính là authId)
    const patient = await this.prisma.auth.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Lấy tất cả appointments của patient
    const appointments = await this.prisma.appointment.findMany({
      where: {
        bookerId: patientId, // bookerId là Auth ID của patient
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
        specialty: {
          select: {
            id: true,
            name: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            serviceCode: true,
            price: true,
            timePerPatient: true,
          },
        },
        appointmentServices: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                serviceCode: true,
                price: true,
                timePerPatient: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'desc', // Sắp xếp theo ngày giảm dần (mới nhất trước)
      },
    });

    // Transform data
    const transformedAppointments: PatientAppointmentDto[] = appointments.map(apt => {
      // Lấy danh sách services từ appointmentServices
      const services: PatientAppointmentServiceDto[] = apt.appointmentServices.map(as => ({
        serviceId: as.service.id,
        serviceName: as.service.name,
        serviceCode: as.service.serviceCode,
        price: as.service.price,
        timePerPatient: as.service.timePerPatient ?? 15,
      }));

      // Nếu không có appointmentServices nhưng có service chính, thêm vào
      if (services.length === 0 && apt.service) {
        services.push({
          serviceId: apt.service.id,
          serviceName: apt.service.name,
          serviceCode: apt.service.serviceCode,
          price: apt.service.price,
          timePerPatient: apt.service.timePerPatient ?? 15,
        });
      }

      return {
        appointmentId: apt.id,
        appointmentCode: apt.appointmentCode,
        doctorId: apt.doctorId,
        doctorName: apt.doctor.auth.name,
        specialtyId: apt.specialtyId,
        specialtyName: apt.specialty.name,
        date: apt.date.toISOString().split('T')[0],
        startTime: apt.startTime,
        endTime: apt.endTime,
        status: apt.status,
        services: services,
        createdAt: new Date().toISOString(), // TODO: Fix createdAt field
      };
    });

    return {
      patientId: patient.id,
      patientName: patient.name,
      totalAppointments: transformedAppointments.length,
      appointments: transformedAppointments,
    };
  }

  /**
   * Parse appointment time từ date và time string
   */
  private parseAppointmentTime(dateStr: string, timeStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    // Create Date object in UTC to match database storage
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  }

}
