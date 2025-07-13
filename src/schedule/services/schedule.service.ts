import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, ScheduleStatus, RequestStatus, RequestType } from '@prisma/client';
import {
  CreateMonthlyScheduleDto,
  CreateScheduleRequestDto,
  ProcessScheduleRequestDto,
  QueryScheduleDto,
  QueryWorkingDaysDto,
  QueryScheduleRequestDto,
  ConflictAction,
} from '../dto';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaClient) {}

  // Tạo lịch cố định hàng tháng
  async createMonthlySchedule(doctorId: string, dto: CreateMonthlyScheduleDto) {
    // Kiểm tra xem bác sĩ đã có đơn gửi lịch cho tháng này chưa
    const existingSubmission = await this.prisma.monthlyScheduleSubmission.findUnique({
      where: {
        doctorId_month_year: {
          doctorId,
          month: dto.month,
          year: dto.year,
        },
      },
    });

    if (existingSubmission) {
      throw new BadRequestException(
        `Bác sĩ đã có đơn gửi lịch cho tháng ${dto.month}/${dto.year}. Vui lòng cập nhật lịch hiện tại hoặc tạo yêu cầu thay đổi.`
      );
    }

    // Validate working days and sessions
    this.validateWorkingDays(dto.workingDays, dto.month, dto.year);

    // Tạo transaction để tạo submission và working days
    return this.prisma.$transaction(async (tx) => {
      // Tạo monthly submission
      const submission = await tx.monthlyScheduleSubmission.create({
        data: {
          doctorId,
          month: dto.month,
          year: dto.year,
          status: ScheduleStatus.PENDING,
        },
      });

      // Tạo working days và sessions
      for (const workingDay of dto.workingDays) {
        const createdWorkingDay = await tx.doctorWorkingDay.create({
          data: {
            doctorId,
            submissionId: submission.id,
            workingDate: new Date(workingDay.workingDate),
          },
        });

        // Tạo working sessions cho ngày này
        for (const session of workingDay.sessions) {
          await tx.workingSession.create({
            data: {
              workingDayId: createdWorkingDay.id,
              startTime: session.startTime,
              endTime: session.endTime,
              sessionType: session.sessionType,
              description: session.description,
            },
          });
        }
      }

      // Trả về submission với đầy đủ thông tin
      return tx.monthlyScheduleSubmission.findUnique({
        where: { id: submission.id },
        include: {
          doctor: {
            include: {
              user: true,
            },
          },
          workingDays: {
            include: {
              sessions: true,
            },
            orderBy: {
              workingDate: 'asc',
            },
          },
        },
      });
    });
  }

  // Tạo yêu cầu thay đổi lịch đột xuất
  async createScheduleRequest(doctorId: string, dto: CreateScheduleRequestDto) {
    // Validate request date (phải là ngày trong tương lai)
    const requestDate = new Date(dto.requestDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (requestDate < today) {
      throw new BadRequestException('Không thể tạo yêu cầu cho ngày trong quá khứ');
    }

    // Validate time slots for non-full-day requests
    if (dto.requestType !== RequestType.FULL_DAY_OFF) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException('Giờ bắt đầu và kết thúc là bắt buộc cho loại yêu cầu này');
      }
      
      if (dto.startTime >= dto.endTime) {
        throw new BadRequestException('Giờ bắt đầu phải nhỏ hơn giờ kết thúc');
      }
    }

    // Generate unique request code
    const requestCode = `REQ${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return this.prisma.scheduleRequest.create({
      data: {
        requestCode,
        doctorId,
        requestType: dto.requestType,
        requestDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason,
        description: dto.description,
        status: RequestStatus.PENDING,
      },
      include: {
        doctor: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  // Lấy danh sách đơn gửi lịch cố định
  async getDoctorSchedules(doctorId: string, query: QueryScheduleDto) {
    const where: any = { doctorId };

    if (query.month) where.month = query.month;
    if (query.year) where.year = query.year;
    if (query.status) where.status = query.status;

    return this.prisma.monthlyScheduleSubmission.findMany({
      where,
      include: {
        doctor: {
          include: {
            user: true,
          },
        },
        clinicAdmin: {
          include: {
            user: true,
          },
        },
        workingDays: {
          include: {
            sessions: true,
          },
          orderBy: {
            workingDate: 'asc',
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { submittedAt: 'desc' },
      ],
    });
  }

  // Lấy danh sách ngày làm việc cụ thể
  async getDoctorWorkingDays(doctorId: string, query: QueryWorkingDaysDto) {
    const where: any = { doctorId };

    if (query.activeOnly !== false) {
      where.isActive = true;
    }

    if (query.startDate || query.endDate) {
      where.workingDate = {};
      if (query.startDate) {
        where.workingDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.workingDate.lte = new Date(query.endDate);
      }
    }

    return this.prisma.doctorWorkingDay.findMany({
      where,
      include: {
        sessions: {
          where: {
            isActive: true,
          },
          orderBy: {
            startTime: 'asc',
          },
        },
        submission: {
          select: {
            id: true,
            month: true,
            year: true,
            status: true,
          },
        },
      },
      orderBy: {
        workingDate: 'asc',
      },
    });
  }

  // Lấy danh sách yêu cầu thay đổi lịch
  async getScheduleRequests(doctorId: string, query: QueryScheduleRequestDto) {
    const where: any = { doctorId };

    if (query.requestType) where.requestType = query.requestType;
    if (query.status) where.status = query.status;

    const skip = ((query.page || 1) - 1) * (query.limit || 10);

    const [requests, total] = await Promise.all([
      this.prisma.scheduleRequest.findMany({
        where,
        include: {
          doctor: {
            include: {
              user: true,
            },
          },
          clinicAdmin: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit || 10,
      }),
      this.prisma.scheduleRequest.count({ where }),
    ]);

    return {
      data: requests,
      pagination: {
        page: query.page || 1,
        limit: query.limit || 10,
        total,
        totalPages: Math.ceil(total / (query.limit || 10)),
      },
    };
  }

  // ===== CLINIC ADMIN METHODS =====

  // Lấy danh sách đơn gửi lịch của tất cả bác sĩ trong phòng khám
  async getClinicSchedules(clinicId: string, query: QueryScheduleDto) {
    const where: any = {
      doctor: { clinicId },
    };

    if (query.month) where.month = query.month;
    if (query.year) where.year = query.year;
    if (query.status) where.status = query.status;
    if (query.doctorId) where.doctorId = query.doctorId;

    return this.prisma.monthlyScheduleSubmission.findMany({
      where,
      include: {
        doctor: {
          include: {
            user: true,
          },
        },
        clinicAdmin: {
          include: {
            user: true,
          },
        },
        workingDays: {
          include: {
            sessions: true,
          },
          orderBy: {
            workingDate: 'asc',
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { submittedAt: 'desc' },
      ],
    });
  }

  // Lấy danh sách ngày làm việc của tất cả bác sĩ trong phòng khám
  async getClinicWorkingDays(clinicId: string, query: QueryWorkingDaysDto) {
    const where: any = {
      doctor: { clinicId },
    };

    if (query.doctorId) where.doctorId = query.doctorId;
    if (query.activeOnly !== false) where.isActive = true;

    if (query.startDate || query.endDate) {
      where.workingDate = {};
      if (query.startDate) {
        where.workingDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.workingDate.lte = new Date(query.endDate);
      }
    }

    return this.prisma.doctorWorkingDay.findMany({
      where,
      include: {
        doctor: {
          include: {
            user: true,
          },
        },
        sessions: {
          where: {
            isActive: true,
          },
          orderBy: {
            startTime: 'asc',
          },
        },
        submission: {
          select: {
            id: true,
            month: true,
            year: true,
            status: true,
          },
        },
      },
      orderBy: [
        { workingDate: 'asc' },
        { doctor: { user: { name: 'asc' } } },
      ],
    });
  }

  // Lấy danh sách yêu cầu thay đổi lịch của tất cả bác sĩ trong phòng khám
  async getClinicScheduleRequests(clinicId: string, query: QueryScheduleRequestDto) {
    const where: any = {
      doctor: { clinicId },
    };

    if (query.requestType) where.requestType = query.requestType;
    if (query.status) where.status = query.status;
    if (query.doctorId) where.doctorId = query.doctorId;

    const skip = ((query.page || 1) - 1) * (query.limit || 10);

    const [requests, total] = await Promise.all([
      this.prisma.scheduleRequest.findMany({
        where,
        include: {
          doctor: {
            include: {
              user: true,
            },
          },
          clinicAdmin: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit || 10,
      }),
      this.prisma.scheduleRequest.count({ where }),
    ]);

    return {
      data: requests,
      pagination: {
        page: query.page || 1,
        limit: query.limit || 10,
        total,
        totalPages: Math.ceil(total / (query.limit || 10)),
      },
    };
  }

  // Duyệt đơn gửi lịch hàng tháng
  async approveMonthlySchedule(submissionId: string, clinicId: string, userId: string) {
    // Lấy clinicAdminId từ userId
    const clinicAdmin = await this.prisma.clinicAdmin.findUnique({
      where: { userId },
    });

    if (!clinicAdmin || clinicAdmin.clinicId !== clinicId) {
      throw new ForbiddenException('Không có quyền duyệt lịch của phòng khám này');
    }

    const submission = await this.prisma.monthlyScheduleSubmission.findUnique({
      where: { id: submissionId },
      include: {
        doctor: {
          include: {
            clinic: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Không tìm thấy đơn gửi lịch');
    }

    if (submission.status !== ScheduleStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể duyệt đơn gửi lịch đang chờ xử lý');
    }

    // Verify submission belongs to the same clinic
    if (submission.doctor.clinicId !== clinicId) {
      throw new ForbiddenException('Không có quyền duyệt lịch của phòng khám khác');
    }

    return this.prisma.monthlyScheduleSubmission.update({
      where: { id: submissionId },
      data: {
        status: ScheduleStatus.APPROVED,
        approvedBy: clinicAdmin.id,
        approvedAt: new Date(),
      },
      include: {
        doctor: {
          include: {
            user: true,
          },
        },
        clinicAdmin: {
          include: {
            user: true,
          },
        },
        workingDays: {
          include: {
            sessions: true,
          },
          orderBy: {
            workingDate: 'asc',
          },
        },
      },
    });
  }

  // Từ chối đơn gửi lịch hàng tháng
  async rejectMonthlySchedule(submissionId: string, clinicId: string, userId: string, reason?: string) {
    // Lấy clinicAdminId từ userId
    const clinicAdmin = await this.prisma.clinicAdmin.findUnique({
      where: { userId },
    });

    if (!clinicAdmin || clinicAdmin.clinicId !== clinicId) {
      throw new ForbiddenException('Không có quyền từ chối lịch của phòng khám này');
    }

    const submission = await this.prisma.monthlyScheduleSubmission.findUnique({
      where: { id: submissionId },
      include: {
        doctor: {
          include: {
            clinic: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Không tìm thấy đơn gửi lịch');
    }

    if (submission.status !== ScheduleStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể từ chối đơn gửi lịch đang chờ xử lý');
    }

    // Verify submission belongs to the same clinic
    if (submission.doctor.clinicId !== clinicId) {
      throw new ForbiddenException('Không có quyền từ chối lịch của phòng khám khác');
    }

    return this.prisma.monthlyScheduleSubmission.update({
      where: { id: submissionId },
      data: {
        status: ScheduleStatus.REJECTED,
        approvedBy: clinicAdmin.id,
        approvedAt: new Date(),
        rejectedReason: reason,
      },
      include: {
        doctor: {
          include: {
            user: true,
          },
        },
        clinicAdmin: {
          include: {
            user: true,
          },
        },
        workingDays: {
          include: {
            sessions: true,
          },
          orderBy: {
            workingDate: 'asc',
          },
        },
      },
    });
  }

  // Xử lý yêu cầu thay đổi lịch
  async processScheduleRequest(
    requestId: string,
    clinicId: string,
    userId: string,
    dto: ProcessScheduleRequestDto
  ) {
    // Lấy clinicAdminId từ userId
    const clinicAdmin = await this.prisma.clinicAdmin.findUnique({
      where: { userId },
    });

    if (!clinicAdmin || clinicAdmin.clinicId !== clinicId) {
      throw new ForbiddenException('Không có quyền xử lý yêu cầu của phòng khám này');
    }
    const request = await this.prisma.scheduleRequest.findUnique({
      where: { id: requestId },
      include: {
        doctor: {
          include: {
            clinic: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể xử lý yêu cầu đang chờ xử lý');
    }

    // Verify request belongs to the same clinic
    if (request.doctor.clinicId !== clinicId) {
      throw new ForbiddenException('Không có quyền xử lý yêu cầu của phòng khám khác');
    }

    // Check for appointment conflicts if request is CANCEL_HOURS or FULL_DAY_OFF
    let affectedAppointments: any[] = [];
    if (
      dto.status === RequestStatus.APPROVED &&
      (request.requestType === RequestType.CANCEL_HOURS || request.requestType === RequestType.FULL_DAY_OFF)
    ) {
      affectedAppointments = await this.checkAppointmentConflicts(request);

      if (affectedAppointments.length > 0 && !dto.conflictAction) {
        throw new BadRequestException(
          'Có lịch hẹn bệnh nhân trong thời gian này. Vui lòng chọn hành động xử lý xung đột.'
        );
      }
    }

    // Process the request
    const updatedRequest = await this.prisma.scheduleRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status,
        processedBy: clinicAdmin.id,
        processedAt: new Date(),
        adminNote: dto.adminNote,
      },
      include: {
        doctor: {
          include: {
            user: true,
          },
        },
        clinicAdmin: {
          include: {
            user: true,
          },
        },
      },
    });

    // Handle appointment conflicts if approved
    if (dto.status === RequestStatus.APPROVED && affectedAppointments.length > 0) {
      await this.handleAppointmentConflicts(affectedAppointments, dto.conflictAction!);
    }

    return updatedRequest;
  }

  // Kiểm tra xung đột với lịch hẹn bệnh nhân
  private async checkAppointmentConflicts(request: any) {
    const whereCondition: any = {
      doctorId: request.doctorId,
      date: request.requestDate,
      status: { not: 'CANCELLED' }, // Không tính các appointment đã hủy
    };

    // Nếu là hủy giờ cụ thể, kiểm tra trong khoảng thời gian đó
    if (request.requestType === RequestType.CANCEL_HOURS) {
      whereCondition.OR = [
        {
          AND: [
            { startTime: { lte: request.endTime } },
            { endTime: { gte: request.startTime } },
          ],
        },
      ];
    }

    return this.prisma.appointment.findMany({
      where: whereCondition,
      include: {
        patient: {
          include: {
            user: true,
          },
        },
        service: true,
      },
    });
  }

  // Xử lý xung đột với lịch hẹn
  private async handleAppointmentConflicts(appointments: any[], action: ConflictAction) {
    switch (action) {
      case ConflictAction.CANCEL_APPOINTMENTS:
        // Hủy tất cả lịch hẹn bị ảnh hưởng
        await this.prisma.appointment.updateMany({
          where: {
            id: { in: appointments.map(apt => apt.id) },
          },
          data: {
            status: 'CANCELLED',
          },
        });
        // TODO: Gửi thông báo cho bệnh nhân
        break;

      case ConflictAction.RESCHEDULE_APPOINTMENTS:
        // TODO: Implement logic để tự động đề xuất lịch mới
        // Hiện tại chỉ đánh dấu cần reschedule
        await this.prisma.appointment.updateMany({
          where: {
            id: { in: appointments.map(apt => apt.id) },
          },
          data: {
            status: 'NEEDS_RESCHEDULE',
          },
        });
        break;

      case ConflictAction.REJECT_REQUEST:
        // Không làm gì với appointments, request sẽ bị từ chối
        break;
    }
  }

  // Validate working days and sessions
  private validateWorkingDays(workingDays: any[], month: number, year: number) {
    if (!workingDays || workingDays.length === 0) {
      throw new BadRequestException('Phải có ít nhất một ngày làm việc trong tháng');
    }

    const workingDateSet = new Set<string>();

    for (const workingDay of workingDays) {
      const workingDate = new Date(workingDay.workingDate);

      // Kiểm tra ngày có thuộc tháng/năm được gửi không
      if (workingDate.getMonth() + 1 !== month || workingDate.getFullYear() !== year) {
        throw new BadRequestException(
          `Ngày ${workingDay.workingDate} không thuộc tháng ${month}/${year}`
        );
      }

      // Kiểm tra trùng lặp ngày
      const dateStr = workingDay.workingDate;
      if (workingDateSet.has(dateStr)) {
        throw new BadRequestException(`Ngày ${dateStr} bị trùng lặp`);
      }
      workingDateSet.add(dateStr);

      // Validate sessions trong ngày
      this.validateWorkingSessions(workingDay.sessions, dateStr);
    }
  }

  // Validate working sessions trong một ngày
  private validateWorkingSessions(sessions: any[], dateStr: string) {
    if (!sessions || sessions.length === 0) {
      throw new BadRequestException(`Ngày ${dateStr} phải có ít nhất một ca làm việc`);
    }

    // Sort sessions by start time
    const sortedSessions = sessions.sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (let i = 0; i < sortedSessions.length; i++) {
      const session = sortedSessions[i];

      // Validate time format and logic
      if (session.startTime >= session.endTime) {
        throw new BadRequestException(
          `Ngày ${dateStr}: Giờ bắt đầu (${session.startTime}) phải nhỏ hơn giờ kết thúc (${session.endTime})`
        );
      }

      // Check for overlapping with next session
      if (i < sortedSessions.length - 1) {
        const nextSession = sortedSessions[i + 1];
        if (session.endTime > nextSession.startTime) {
          throw new BadRequestException(
            `Ngày ${dateStr}: Ca làm việc từ ${session.startTime}-${session.endTime} bị xung đột với ca ${nextSession.startTime}-${nextSession.endTime}`
          );
        }
      }
    }
  }
}
