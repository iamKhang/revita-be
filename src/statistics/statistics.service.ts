/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  QueryPeriodDto,
  TimePeriod,
  QuickKpiResponseDto,
  AppointmentStatsDto,
  PatientStatsDto,
  DoctorRatingStatsDto,
  RevenueResponseDto,
  RevenueOverviewDto,
  RevenueByTimeDto,
  RevenueBySpecialtyDto,
  RevenueByServiceDto,
  WorkSessionStatsResponseDto,
  WorkSessionByDoctorDto,
  WorkSessionByTechnicianDto,
  ExaminationVolumeStatsResponseDto,
  ExaminationByDoctorDto,
  ExaminationByTimeDto,
  PaymentMethodStatsResponseDto,
  RevenueByPaymentMethodDto,
  TopServicesStatsResponseDto,
  TopServiceDto,
  TopPackageDto,
  RevenueStructureDto,
  PatientSpendingHistoryResponseDto,
  PatientSpendingQueryDto,
  PatientFamilySpendingDto,
  PatientProfileSpendingDto,
  UserContext,
} from './dto';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Lấy doctorId từ authId
   */
  private async getDoctorIdFromAuthId(authId: string): Promise<string | null> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { authId },
      select: { id: true },
    });
    return doctor?.id || null;
  }

  /**
   * Helper: Lấy technicianId từ authId
   */
  private async getTechnicianIdFromAuthId(
    authId: string,
  ): Promise<string | null> {
    const technician = await this.prisma.technician.findUnique({
      where: { authId },
      select: { id: true },
    });
    return technician?.id || null;
  }

  /**
   * Helper: Lấy patientId từ authId
   */
  private async getPatientIdFromAuthId(authId: string): Promise<string | null> {
    const patient = await this.prisma.patient.findUnique({
      where: { authId },
      select: { id: true },
    });
    return patient?.id || null;
  }

  /**
   * Helper: Tính toán khoảng thời gian từ QueryPeriodDto
   */
  private calculateDateRange(query: QueryPeriodDto): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    if (
      query.period === TimePeriod.CUSTOM &&
      query.startDate &&
      query.endDate
    ) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
    } else {
      switch (query.period) {
        case TimePeriod.DAY:
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case TimePeriod.WEEK:
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case TimePeriod.MONTH:
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case TimePeriod.YEAR:
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        default:
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
      }
    }

    return { startDate, endDate };
  }

  /**
   * 1. KPI Nhanh
   */
  async getQuickKpi(
    query: QueryPeriodDto,
    _user: UserContext,
  ): Promise<QuickKpiResponseDto> {
    const { startDate, endDate } = this.calculateDateRange(query);

    // Thống kê lượt đặt khám
    const appointmentStats = await this.getAppointmentStats(startDate, endDate);

    // Thống kê bệnh nhân mới/quay lại
    const patientStats = await this.getPatientStats(startDate, endDate);

    // Thống kê đánh giá bác sĩ
    const doctorRatingStats = await this.getDoctorRatingStats();

    return {
      appointmentStats,
      patientStats,
      doctorRatingStats,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  private async getAppointmentStats(
    startDate: Date,
    endDate: Date,
  ): Promise<AppointmentStatsDto> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        status: true,
      },
    });

    const total = appointments.length;
    const confirmed = appointments.filter(
      (a) => a.status === 'CONFIRMED',
    ).length;
    const completed = appointments.filter(
      (a) => a.status === 'COMPLETED',
    ).length;
    const cancelled = appointments.filter(
      (a) => a.status === 'CANCELLED',
    ).length;
    const pending = appointments.filter((a) => a.status === 'PENDING').length;

    return {
      total,
      confirmed,
      completed,
      cancelled,
      pending,
      confirmedPercent: total > 0 ? (confirmed / total) * 100 : 0,
      completedPercent: total > 0 ? (completed / total) * 100 : 0,
      cancelledPercent: total > 0 ? (cancelled / total) * 100 : 0,
    };
  }

  private async getPatientStats(
    startDate: Date,
    endDate: Date,
  ): Promise<PatientStatsDto> {
    // Lấy tất cả PatientProfile có appointments trong khoảng thời gian
    const patientProfiles = await this.prisma.patientProfile.findMany({
      where: {
        appointments: {
          some: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      include: {
        appointments: {
          orderBy: {
            date: 'asc',
          },
        },
      },
    });

    let newPatients = 0;
    let returningPatients = 0;

    for (const profile of patientProfiles) {
      // Kiểm tra xem appointment đầu tiên của profile có nằm trong khoảng thời gian không
      if (profile.appointments.length > 0) {
        const firstAppointmentDate = profile.appointments[0].date;
        if (
          firstAppointmentDate >= startDate &&
          firstAppointmentDate <= endDate
        ) {
          newPatients++;
        } else {
          returningPatients++;
        }
      }
    }

    const totalPatients = newPatients + returningPatients;

    return {
      newPatients,
      returningPatients,
      totalPatients,
      newPatientsPercent:
        totalPatients > 0 ? (newPatients / totalPatients) * 100 : 0,
      returningPatientsPercent:
        totalPatients > 0 ? (returningPatients / totalPatients) * 100 : 0,
    };
  }

  private async getDoctorRatingStats(): Promise<DoctorRatingStatsDto> {
    // Lấy thống kê từ bảng doctor_ratings thay vì từ trường rating cũ
    const [doctors, ratingStats] = await Promise.all([
      this.prisma.doctor.findMany({
        select: {
          rating: true, // Rating trung bình đã được tính
          ratingCount: true,
          isActive: true,
        },
      }),
      this.prisma.doctorRating.aggregate({
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    const totalDoctors = doctors.length;
    const activeDoctors = doctors.filter((d) => d.isActive).length;

    // Sử dụng rating trung bình từ bảng doctor_ratings
    const averageRating = ratingStats._avg.rating || 0;
    const totalRatings = ratingStats._count.rating || 0;

    // Phân phối đánh giá từ bảng doctor_ratings
    const ratingDistributionRaw = await this.prisma.doctorRating.groupBy({
      by: ['rating'],
      _count: { rating: true },
      orderBy: { rating: 'desc' },
    });

    const ratingDistribution = ratingDistributionRaw.map((item) => ({
      rating: item.rating,
      count: item._count.rating,
    }));

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalDoctors,
      activeDoctors,
      totalRatings,
      ratingDistribution,
    };
  }

  /**
   * 2. Doanh thu
   */
  async getRevenueStats(
    query: QueryPeriodDto,
    _user: UserContext,
  ): Promise<RevenueResponseDto> {
    const { startDate, endDate } = this.calculateDateRange(query);

    const overview = await this.getRevenueOverview(startDate, endDate);
    const byTime = await this.getRevenueByTime(
      startDate,
      endDate,
      query.period || TimePeriod.DAY,
    );
    const bySpecialty = await this.getRevenueBySpecialty(startDate, endDate);
    const byService = await this.getRevenueByService(startDate, endDate);

    return {
      overview,
      byTime,
      bySpecialty,
      byService,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        periodType: query.period || TimePeriod.DAY,
      },
    };
  }

  private async getRevenueOverview(
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueOverviewDto> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        totalAmount: true,
        amountPaid: true,
        isPaid: true,
      },
    });

    const totalRevenue = invoices.reduce(
      (sum, inv) => sum + inv.totalAmount,
      0,
    );
    const paidRevenue = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const accountsReceivable = totalRevenue - paidRevenue;

    return {
      totalRevenue,
      paidRevenue,
      accountsReceivable,
      paidPercent: totalRevenue > 0 ? (paidRevenue / totalRevenue) * 100 : 0,
      arPercent:
        totalRevenue > 0 ? (accountsReceivable / totalRevenue) * 100 : 0,
    };
  }

  private async getRevenueByTime(
    startDate: Date,
    endDate: Date,
    period: TimePeriod,
  ): Promise<RevenueByTimeDto[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        totalAmount: true,
        amountPaid: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Nhóm theo ngày/tuần/tháng
    const groupedData = new Map<string, RevenueByTimeDto>();

    invoices.forEach((invoice) => {
      let dateKey: string;
      const invoiceDate = new Date(invoice.createdAt);

      switch (period) {
        case TimePeriod.DAY:
          dateKey = invoiceDate.toISOString().split('T')[0];
          break;
        case TimePeriod.WEEK: {
          // Lấy đầu tuần (Monday)
          const weekStart = new Date(invoiceDate);
          weekStart.setDate(invoiceDate.getDate() - invoiceDate.getDay() + 1);
          dateKey = weekStart.toISOString().split('T')[0];
          break;
        }
        case TimePeriod.MONTH:
          dateKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          dateKey = invoiceDate.toISOString().split('T')[0];
      }

      if (!groupedData.has(dateKey)) {
        groupedData.set(dateKey, {
          date: dateKey,
          totalRevenue: 0,
          paidRevenue: 0,
          accountsReceivable: 0,
          invoiceCount: 0,
        });
      }

      const data = groupedData.get(dateKey)!;
      data.totalRevenue += invoice.totalAmount;
      data.paidRevenue += invoice.amountPaid;
      data.accountsReceivable = data.totalRevenue - data.paidRevenue;
      data.invoiceCount++;
    });

    return Array.from(groupedData.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  private async getRevenueBySpecialty(
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueBySpecialtyDto[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        specialty: true,
        patientProfile: {
          include: {
            invoices: {
              where: {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        },
      },
    });

    const specialtyMap = new Map<
      string,
      {
        specialty: { name: string; specialtyCode: string };
        totalRevenue: number;
        paidRevenue: number;
        count: number;
      }
    >();

    appointments.forEach((apt) => {
      const key = apt.specialtyId;
      if (!specialtyMap.has(key)) {
        specialtyMap.set(key, {
          specialty: apt.specialty,
          totalRevenue: 0,
          paidRevenue: 0,
          count: 0,
        });
      }

      const data = specialtyMap.get(key)!;
      data.count++;

      // Tính revenue từ invoices của patient profile
      apt.patientProfile.invoices.forEach((inv) => {
        data.totalRevenue += inv.totalAmount;
        data.paidRevenue += inv.amountPaid;
      });
    });

    const totalRevenue = Array.from(specialtyMap.values()).reduce(
      (sum, data) => sum + data.totalRevenue,
      0,
    );

    return Array.from(specialtyMap.entries())
      .map(([specialtyId, data]) => ({
        specialtyId,
        specialtyName: data.specialty.name,
        specialtyCode: data.specialty.specialtyCode,
        totalRevenue: data.totalRevenue,
        paidRevenue: data.paidRevenue,
        appointmentCount: data.count,
        revenuePercent:
          totalRevenue > 0 ? (data.totalRevenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  private async getRevenueByService(
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueByServiceDto[]> {
    const invoiceDetails = await this.prisma.invoiceDetail.findMany({
      where: {
        invoice: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        service: true,
        invoice: true,
      },
    });

    const serviceMap = new Map<
      string,
      {
        service: { name: string; serviceCode: string };
        totalRevenue: number;
        paidRevenue: number;
        count: number;
      }
    >();

    invoiceDetails.forEach((detail) => {
      const key = detail.serviceId;
      if (!serviceMap.has(key)) {
        serviceMap.set(key, {
          service: detail.service,
          totalRevenue: 0,
          paidRevenue: 0,
          count: 0,
        });
      }

      const data = serviceMap.get(key)!;
      data.totalRevenue += detail.price;
      // Tính phần paid tương ứng với service này
      const paidRatio =
        detail.invoice.totalAmount > 0
          ? detail.invoice.amountPaid / detail.invoice.totalAmount
          : 0;
      data.paidRevenue += detail.price * paidRatio;
      data.count++;
    });

    const totalRevenue = Array.from(serviceMap.values()).reduce(
      (sum, data) => sum + data.totalRevenue,
      0,
    );

    return Array.from(serviceMap.entries())
      .map(([serviceId, data]) => ({
        serviceId,
        serviceName: data.service.name,
        serviceCode: data.service.serviceCode,
        totalRevenue: data.totalRevenue,
        paidRevenue: data.paidRevenue,
        usageCount: data.count,
        revenuePercent:
          totalRevenue > 0 ? (data.totalRevenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * 3. Lịch làm việc (Work Session)
   */
  async getWorkSessionStats(
    query: QueryPeriodDto,
    user: UserContext,
  ): Promise<WorkSessionStatsResponseDto> {
    const { startDate, endDate } = this.calculateDateRange(query);

    // Build where clause based on user role
    interface WorkSessionWhereInput {
      startTime: {
        gte: Date;
        lte: Date;
      };
      doctorId?: string;
      technicianId?: string;
    }

    const whereClause: WorkSessionWhereInput = {
      startTime: {
        gte: startDate,
        lte: endDate,
      },
    };

    // If DOCTOR, only show their own sessions
    if (user.role === 'DOCTOR') {
      const doctorId = await this.getDoctorIdFromAuthId(user.id);
      if (!doctorId) {
        throw new ForbiddenException('Doctor not found');
      }
      whereClause.doctorId = doctorId;
    }

    // If TECHNICIAN, only show their own sessions
    if (user.role === 'TECHNICIAN') {
      const technicianId = await this.getTechnicianIdFromAuthId(user.id);
      if (!technicianId) {
        throw new ForbiddenException('Technician not found');
      }
      whereClause.technicianId = technicianId;
    }

    const workSessions = await this.prisma.workSession.findMany({
      where: whereClause,
      include: {
        doctor: {
          include: {
            auth: true,
          },
        },
        technician: {
          include: {
            auth: true,
          },
        },
      },
    });

    // Thống kê theo bác sĩ
    const doctorMap = new Map<string, WorkSessionByDoctorDto>();
    // Thống kê theo kỹ thuật viên
    const technicianMap = new Map<string, WorkSessionByTechnicianDto>();

    workSessions.forEach((ws) => {
      if (ws.doctor) {
        const key = ws.doctorId!;
        if (!doctorMap.has(key)) {
          doctorMap.set(key, {
            doctorId: ws.doctor.id,
            doctorName: ws.doctor.auth.name,
            doctorCode: ws.doctor.doctorCode,
            totalSessions: 0,
            completedSessions: 0,
            canceledSessions: 0,
            inProgressSessions: 0,
            pendingSessions: 0,
            approvedSessions: 0,
            completedPercent: 0,
            canceledPercent: 0,
            totalWorkHours: 0,
          });
        }

        const data = doctorMap.get(key)!;
        data.totalSessions++;

        switch (ws.status) {
          case 'COMPLETED':
            data.completedSessions++;
            break;
          case 'CANCELED':
            data.canceledSessions++;
            break;
          case 'IN_PROGRESS':
            data.inProgressSessions++;
            break;
          case 'PENDING':
            data.pendingSessions++;
            break;
          case 'APPROVED':
            data.approvedSessions++;
            break;
        }

        // Tính giờ làm việc
        const hours =
          (ws.endTime.getTime() - ws.startTime.getTime()) / (1000 * 60 * 60);
        data.totalWorkHours += hours;
      }

      if (ws.technician) {
        const key = ws.technicianId!;
        if (!technicianMap.has(key)) {
          technicianMap.set(key, {
            technicianId: ws.technician.id,
            technicianName: ws.technician.auth.name,
            technicianCode: ws.technician.technicianCode,
            totalSessions: 0,
            completedSessions: 0,
            canceledSessions: 0,
            inProgressSessions: 0,
            pendingSessions: 0,
            approvedSessions: 0,
            completedPercent: 0,
            canceledPercent: 0,
            totalWorkHours: 0,
          });
        }

        const data = technicianMap.get(key)!;
        data.totalSessions++;

        switch (ws.status) {
          case 'COMPLETED':
            data.completedSessions++;
            break;
          case 'CANCELED':
            data.canceledSessions++;
            break;
          case 'IN_PROGRESS':
            data.inProgressSessions++;
            break;
          case 'PENDING':
            data.pendingSessions++;
            break;
          case 'APPROVED':
            data.approvedSessions++;
            break;
        }

        const hours =
          (ws.endTime.getTime() - ws.startTime.getTime()) / (1000 * 60 * 60);
        data.totalWorkHours += hours;
      }
    });

    // Tính phần trăm
    const byDoctor = Array.from(doctorMap.values()).map((d) => ({
      ...d,
      completedPercent:
        d.totalSessions > 0 ? (d.completedSessions / d.totalSessions) * 100 : 0,
      canceledPercent:
        d.totalSessions > 0 ? (d.canceledSessions / d.totalSessions) * 100 : 0,
    }));

    const byTechnician = Array.from(technicianMap.values()).map((t) => ({
      ...t,
      completedPercent:
        t.totalSessions > 0 ? (t.completedSessions / t.totalSessions) * 100 : 0,
      canceledPercent:
        t.totalSessions > 0 ? (t.canceledSessions / t.totalSessions) * 100 : 0,
    }));

    // Tổng hợp
    const totalSessions = workSessions.length;
    const completedSessions = workSessions.filter(
      (ws) => ws.status === 'COMPLETED',
    ).length;
    const canceledSessions = workSessions.filter(
      (ws) => ws.status === 'CANCELED',
    ).length;

    return {
      byDoctor,
      byTechnician,
      summary: {
        totalSessions,
        completedSessions,
        canceledSessions,
        completedPercent:
          totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
        canceledPercent:
          totalSessions > 0 ? (canceledSessions / totalSessions) * 100 : 0,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  /**
   * 4. Khối lượng khám
   */
  async getExaminationVolumeStats(
    query: QueryPeriodDto,
    user: UserContext,
  ): Promise<ExaminationVolumeStatsResponseDto> {
    const { startDate, endDate } = this.calculateDateRange(query);

    // Build where clause based on user role
    interface AppointmentWhereInput {
      date: {
        gte: Date;
        lte: Date;
      };
      doctorId?: string;
    }

    const whereClause: AppointmentWhereInput = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // If DOCTOR, only show their own appointments
    if (user.role === 'DOCTOR') {
      const doctorId = await this.getDoctorIdFromAuthId(user.id);
      if (!doctorId) {
        throw new ForbiddenException('Doctor not found');
      }
      whereClause.doctorId = doctorId;
    }

    const appointments = await this.prisma.appointment.findMany({
      where: whereClause,
      include: {
        doctor: {
          include: {
            auth: true,
          },
        },
        service: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Tính số ngày trong khoảng thời gian
    const daysInPeriod = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const weeksInPeriod = daysInPeriod / 7;
    const monthsInPeriod = daysInPeriod / 30;

    // Thống kê theo bác sĩ
    const doctorMap = new Map<string, ExaminationByDoctorDto>();

    appointments.forEach((apt) => {
      const key = apt.doctorId;
      if (!doctorMap.has(key)) {
        doctorMap.set(key, {
          doctorId: apt.doctor.id,
          doctorName: apt.doctor.auth.name,
          doctorCode: apt.doctor.doctorCode,
          appointmentsPerDay: 0,
          appointmentsPerWeek: 0,
          appointmentsPerMonth: 0,
          totalAppointments: 0,
          completedAppointments: 0,
          averageDurationMinutes: 0,
        });
      }

      const data = doctorMap.get(key)!;
      data.totalAppointments++;
      if (apt.status === 'COMPLETED') {
        data.completedAppointments++;
      }

      // Tính thời lượng từ service
      if (apt.service && apt.service.durationMinutes) {
        data.averageDurationMinutes += apt.service.durationMinutes;
      }
    });

    const byDoctor = Array.from(doctorMap.values()).map((d) => ({
      ...d,
      appointmentsPerDay:
        daysInPeriod > 0 ? d.totalAppointments / daysInPeriod : 0,
      appointmentsPerWeek:
        weeksInPeriod > 0 ? d.totalAppointments / weeksInPeriod : 0,
      appointmentsPerMonth:
        monthsInPeriod > 0 ? d.totalAppointments / monthsInPeriod : 0,
      averageDurationMinutes:
        d.totalAppointments > 0
          ? d.averageDurationMinutes / d.totalAppointments
          : 0,
    }));

    // Thống kê theo thời gian
    const timeMap = new Map<string, ExaminationByTimeDto>();

    appointments.forEach((apt) => {
      const dateKey = apt.date.toISOString().split('T')[0];
      if (!timeMap.has(dateKey)) {
        timeMap.set(dateKey, {
          date: dateKey,
          totalAppointments: 0,
          completedAppointments: 0,
          averageDurationMinutes: 0,
        });
      }

      const data = timeMap.get(dateKey)!;
      data.totalAppointments++;
      if (apt.status === 'COMPLETED') {
        data.completedAppointments++;
      }

      if (apt.service && apt.service.durationMinutes) {
        data.averageDurationMinutes += apt.service.durationMinutes;
      }
    });

    const byTime = Array.from(timeMap.values())
      .map((t) => ({
        ...t,
        averageDurationMinutes:
          t.totalAppointments > 0
            ? t.averageDurationMinutes / t.totalAppointments
            : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter(
      (a) => a.status === 'COMPLETED',
    ).length;
    const totalDuration = appointments.reduce(
      (sum, a) => sum + (a.service?.durationMinutes || 0),
      0,
    );

    return {
      byDoctor,
      byTime,
      summary: {
        totalAppointments,
        completedAppointments,
        averageDurationMinutes:
          totalAppointments > 0 ? totalDuration / totalAppointments : 0,
        appointmentsPerDay:
          daysInPeriod > 0 ? totalAppointments / daysInPeriod : 0,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  /**
   * 5. Doanh thu theo phương thức thanh toán
   */
  async getPaymentMethodStats(
    query: QueryPeriodDto,
    _user: UserContext,
  ): Promise<PaymentMethodStatsResponseDto> {
    const { startDate, endDate } = this.calculateDateRange(query);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        paymentMethod: true,
        totalAmount: true,
        amountPaid: true,
        isPaid: true,
      },
    });

    const paymentMethodMap = new Map<
      'CASH' | 'TRANSFER',
      {
        totalRevenue: number;
        paidRevenue: number;
        count: number;
        paidCount: number;
      }
    >();

    invoices.forEach((inv) => {
      const method = inv.paymentMethod;
      if (!paymentMethodMap.has(method)) {
        paymentMethodMap.set(method, {
          totalRevenue: 0,
          paidRevenue: 0,
          count: 0,
          paidCount: 0,
        });
      }

      const data = paymentMethodMap.get(method)!;
      data.totalRevenue += inv.totalAmount;
      data.paidRevenue += inv.amountPaid;
      data.count++;
      if (inv.isPaid) {
        data.paidCount++;
      }
    });

    const totalRevenue = Array.from(paymentMethodMap.values()).reduce(
      (sum, data) => sum + data.totalRevenue,
      0,
    );

    const byPaymentMethod: RevenueByPaymentMethodDto[] = Array.from(
      paymentMethodMap.entries(),
    ).map(([method, data]) => ({
      paymentMethod: method,
      totalRevenue: data.totalRevenue,
      paidRevenue: data.paidRevenue,
      invoiceCount: data.count,
      paidInvoiceCount: data.paidCount,
      paidPercent: data.count > 0 ? (data.paidCount / data.count) * 100 : 0,
      revenuePercent:
        totalRevenue > 0 ? (data.totalRevenue / totalRevenue) * 100 : 0,
    }));

    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter((inv) => inv.isPaid).length;
    const totalPaidRevenue = invoices.reduce(
      (sum, inv) => sum + inv.amountPaid,
      0,
    );
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    return {
      byPaymentMethod,
      summary: {
        totalRevenue: totalAmount,
        paidRevenue: totalPaidRevenue,
        totalInvoices,
        paidInvoices,
        overallPaidPercent:
          totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  /**
   * 6. Top dịch vụ/gói
   */
  async getTopServicesStats(
    query: QueryPeriodDto,
    _user: UserContext,
  ): Promise<TopServicesStatsResponseDto> {
    const { startDate, endDate } = this.calculateDateRange(query);

    // Top Services
    const serviceDetails = await this.prisma.invoiceDetail.findMany({
      where: {
        invoice: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        service: true,
        invoice: true,
      },
    });

    const serviceMap = new Map<
      string,
      {
        service: { name: string; serviceCode: string };
        usageCount: number;
        totalRevenue: number;
        paidRevenue: number;
      }
    >();

    serviceDetails.forEach((detail) => {
      const key = detail.serviceId;
      if (!serviceMap.has(key)) {
        serviceMap.set(key, {
          service: detail.service,
          usageCount: 0,
          totalRevenue: 0,
          paidRevenue: 0,
        });
      }

      const data = serviceMap.get(key)!;
      data.usageCount++;
      data.totalRevenue += detail.price;
      const paidRatio =
        detail.invoice.totalAmount > 0
          ? detail.invoice.amountPaid / detail.invoice.totalAmount
          : 0;
      data.paidRevenue += detail.price * paidRatio;
    });

    const totalServiceRevenue = Array.from(serviceMap.values()).reduce(
      (sum, data) => sum + data.totalRevenue,
      0,
    );
    const totalServiceUsage = Array.from(serviceMap.values()).reduce(
      (sum, data) => sum + data.usageCount,
      0,
    );

    const topServices: TopServiceDto[] = Array.from(serviceMap.entries())
      .map(([serviceId, data]) => ({
        serviceId,
        serviceName: data.service.name,
        serviceCode: data.service.serviceCode,
        usageCount: data.usageCount,
        totalRevenue: data.totalRevenue,
        paidRevenue: data.paidRevenue,
        revenuePercent:
          totalServiceRevenue > 0
            ? (data.totalRevenue / totalServiceRevenue) * 100
            : 0,
        usagePercent:
          totalServiceUsage > 0
            ? (data.usageCount / totalServiceUsage) * 100
            : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 20); // Top 20

    // Top Packages (simplified - assuming packages are tracked in invoices)
    // This is a placeholder as the current schema doesn't have direct package tracking in invoices
    const topPackages: TopPackageDto[] = [];

    // Revenue Structure by Category
    const services = await this.prisma.service.findMany({
      where: {
        invoiceDetails: {
          some: {
            invoice: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        },
      },
      include: {
        category: true,
        invoiceDetails: {
          where: {
            invoice: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
          include: {
            invoice: true,
          },
        },
      },
    });

    const categoryMap = new Map<
      string,
      { name: string; revenue: number; count: number }
    >();

    services.forEach((service) => {
      const categoryKey = service.category?.code || 'UNCATEGORIZED';
      const categoryName = service.category?.name || 'Chưa phân loại';

      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          name: categoryName,
          revenue: 0,
          count: 0,
        });
      }

      const catData = categoryMap.get(categoryKey)!;
      service.invoiceDetails.forEach((detail) => {
        catData.revenue += detail.price;
        catData.count++;
      });
    });

    const totalCategoryRevenue = Array.from(categoryMap.values()).reduce(
      (sum, data) => sum + data.revenue,
      0,
    );

    const revenueStructure: RevenueStructureDto[] = Array.from(
      categoryMap.entries(),
    ).map(([category, data]) => ({
      category,
      categoryName: data.name,
      totalRevenue: data.revenue,
      revenuePercent:
        totalCategoryRevenue > 0
          ? (data.revenue / totalCategoryRevenue) * 100
          : 0,
      itemCount: data.count,
    }));

    return {
      topServices,
      topPackages,
      revenueStructure,
      summary: {
        totalServiceRevenue,
        totalPackageRevenue: 0, // Placeholder
        totalServiceUsage,
        totalPackageUsage: 0, // Placeholder
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  /**
   * 7. Lịch sử chi tiêu bệnh nhân / gia đình
   */
  async getPatientSpendingHistory(
    queryDto: PatientSpendingQueryDto,
    periodDto: QueryPeriodDto,
    user: UserContext,
  ): Promise<PatientSpendingHistoryResponseDto> {
    const { startDate, endDate } = this.calculateDateRange(periodDto);

    // If PATIENT role, auto-fill their patientId
    let patientId = queryDto.patientId;
    let patientProfileId = queryDto.patientProfileId;

    if (user.role === 'PATIENT') {
      const userPatientId = await this.getPatientIdFromAuthId(user.id);
      if (!userPatientId) {
        throw new ForbiddenException('Patient not found');
      }

      // Patient can only see their own data
      if (queryDto.patientId && queryDto.patientId !== userPatientId) {
        throw new ForbiddenException(
          'You can only view your own spending history',
        );
      }

      // Validate patientProfileId belongs to this patient
      if (queryDto.patientProfileId) {
        const profile = await this.prisma.patientProfile.findUnique({
          where: { id: queryDto.patientProfileId },
          select: { patientId: true },
        });

        if (!profile || profile.patientId !== userPatientId) {
          throw new ForbiddenException(
            'You can only view your own profile spending',
          );
        }
        patientProfileId = queryDto.patientProfileId;
      } else {
        // If no specific ID provided, default to their own
        patientId = userPatientId;
      }
    }

    // Nếu có patientProfileId, lấy thống kê cho profile đó
    if (patientProfileId) {
      const profileSpending = await this.getPatientProfileSpending(
        patientProfileId,
        startDate,
        endDate,
      );

      return {
        profileSpending,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      };
    }

    // Nếu có patientId, lấy thống kê cho cả gia đình (patient + tất cả profiles)
    if (patientId) {
      const familySpending = await this.getPatientFamilySpending(
        patientId,
        startDate,
        endDate,
      );

      return {
        familySpending,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      };
    }

    throw new Error('Either patientId or patientProfileId must be provided');
  }

  private async getPatientProfileSpending(
    patientProfileId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PatientProfileSpendingDto> {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      include: {
        invoices: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        appointments: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            date: 'desc',
          },
        },
      },
    });

    if (!profile) {
      throw new Error('Patient profile not found');
    }

    const totalSpent = profile.invoices.reduce(
      (sum, inv) => sum + inv.totalAmount,
      0,
    );
    const totalPaid = profile.invoices.reduce(
      (sum, inv) => sum + inv.amountPaid,
      0,
    );
    const accountsReceivable = totalSpent - totalPaid;

    return {
      patientProfileId: profile.id,
      profileCode: profile.profileCode,
      profileName: profile.name,
      relationship: profile.relationship,
      totalSpent,
      totalPaid,
      accountsReceivable,
      invoiceCount: profile.invoices.length,
      appointmentCount: profile.appointments.length,
      lastVisit:
        profile.appointments.length > 0
          ? profile.appointments[0].date.toISOString()
          : null,
    };
  }

  private async getPatientFamilySpending(
    patientId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PatientFamilySpendingDto> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        auth: true,
        patientProfiles: {
          include: {
            invoices: {
              where: {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
            appointments: {
              where: {
                date: {
                  gte: startDate,
                  lte: endDate,
                },
              },
              orderBy: {
                date: 'desc',
              },
            },
          },
        },
      },
    });

    if (!patient) {
      throw new Error('Patient not found');
    }

    const profiles: PatientProfileSpendingDto[] = patient.patientProfiles.map(
      (profile) => {
        const totalSpent = profile.invoices.reduce(
          (sum, inv) => sum + inv.totalAmount,
          0,
        );
        const totalPaid = profile.invoices.reduce(
          (sum, inv) => sum + inv.amountPaid,
          0,
        );
        const accountsReceivable = totalSpent - totalPaid;

        return {
          patientProfileId: profile.id,
          profileCode: profile.profileCode,
          profileName: profile.name,
          relationship: profile.relationship,
          totalSpent,
          totalPaid,
          accountsReceivable,
          invoiceCount: profile.invoices.length,
          appointmentCount: profile.appointments.length,
          lastVisit:
            profile.appointments.length > 0
              ? profile.appointments[0].date.toISOString()
              : null,
        };
      },
    );

    const totalSpent = profiles.reduce((sum, p) => sum + p.totalSpent, 0);
    const totalPaid = profiles.reduce((sum, p) => sum + p.totalPaid, 0);
    const accountsReceivable = totalSpent - totalPaid;
    const totalInvoices = profiles.reduce((sum, p) => sum + p.invoiceCount, 0);
    const totalAppointments = profiles.reduce(
      (sum, p) => sum + p.appointmentCount,
      0,
    );

    return {
      patientId: patient.id,
      patientCode: patient.patientCode,
      patientName: patient.auth?.name || null,
      totalSpent,
      totalPaid,
      accountsReceivable,
      totalInvoices,
      totalAppointments,
      profileCount: profiles.length,
      profiles,
    };
  }
}
