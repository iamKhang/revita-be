import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStreamService, QueueTicket } from '../cache/redis-stream.service';
import { WebSocketService } from '../websocket/websocket.service';
import { RedisService } from '../cache/redis.service';
import { TakeNumberDto } from './dto/take-number.dto';
import { 
  calculatePriorityScore, 
  getPriorityLevel 
} from '../utils/priority.utils';

export interface TakeNumberResult {
  success: true;
  ticket: {
    ticketId: string;
    queueNumber: string;
    counterId: string;
    counterCode: string;
    counterName: string;
    patientName: string;
    patientAge: number;
    priorityScore: number;
    priorityLevel: string;
    estimatedWaitTime: number;
    assignedAt: string;
  };
  patientInfo: {
    name: string;
    age: number;
    gender: string;
    hasAppointment: boolean;
    appointmentDetails?: any;
  };
}

@Injectable()
export class TakeNumberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisStream: RedisStreamService,
    private readonly webSocket: WebSocketService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Chạy một promise với timeout. Nếu quá thời gian thì dùng fallback.
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback: () => T,
  ): Promise<T> {
    return await Promise.race<Promise<T>>([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback()), timeoutMs)),
    ]);
  }

  /**
   * Bốc số cho bệnh nhân
   */
  async takeNumber(request: TakeNumberDto): Promise<TakeNumberResult> {
    const t0 = Date.now();
    const tlog = (label: string, tPrev: number) => {
      const now = Date.now();
      const delta = now - tPrev;
      return now;
    };
    let t = t0;
    let patientInfo: any = null;
    let hasAppointment = false;
    let appointmentDetails: any = null;

    // Tìm thông tin bệnh nhân từ mã hồ sơ hoặc mã lịch khám
    if (request.patientProfileCode) {
      patientInfo = await this.withTimeout(
        this.getPatientByProfileCode(request.patientProfileCode),
        500,
        () => null,
      );
    } else if (request.appointmentCode) {
      const result = await this.withTimeout(
        this.getPatientByAppointmentCode(request.appointmentCode),
        500,
        () => ({ patientInfo: null as any, appointmentDetails: null as any }),
      );
      patientInfo = result.patientInfo;
      hasAppointment = true;
      appointmentDetails = result.appointmentDetails;
    }
    t = tlog('patient lookup', t);

    // Nếu không tìm thấy thông tin từ mã, sử dụng thông tin từ request
    if (!patientInfo) {
      if (!request.patientName) {
        throw new BadRequestException('Không tìm thấy thông tin bệnh nhân. Vui lòng cung cấp tên bệnh nhân.');
      }
      if (!request.patientAge) {
        throw new BadRequestException('Vui lòng cung cấp tuổi bệnh nhân để tính điểm ưu tiên.');
      }
      patientInfo = {
        name: request.patientName,
        age: request.patientAge,
        gender: request.patientGender || 'UNKNOWN',
        phone: request.patientPhone,
        dateOfBirth: new Date(new Date().getFullYear() - request.patientAge, 0, 1),
      };
    }

    // Tính điểm ưu tiên
    const priorityScore = this.calculatePatientPriority(
      patientInfo,
      hasAppointment,
      appointmentDetails,
      request,
    );

    const priorityLevel = getPriorityLevel(priorityScore);
    t = tlog('priority calculation', t);

    // Chọn counter phù hợp
    const counter = await this.selectBestCounter(priorityScore);
    t = tlog('select counter', t);

    // Tạo ticket
    const ticket = await this.createTicket(
      patientInfo,
      priorityScore,
      priorityLevel,
      counter,
      request,
      hasAppointment,
      appointmentDetails,
    );
    t = tlog('create ticket', t);

    // Thực hiện song song: lưu stream, enqueue ZSET, notify WS
    const enqueueItem: any = {
      ...ticket,
      status: 'READY',
      callCount: 0,
      isPriority: ticket.priorityScore >= 100, // flag tuỳ vào score nếu cần
    };
    // Thực thi nền để không chặn response nếu Redis/WebSocket chậm
    void this.redisStream.addTicketToStream(ticket)
      .catch((e) => console.warn('[take-number] addTicketToStream error', (e as Error).message));
    void this.redis.pushToCounterQueue(counter.id, enqueueItem)
      .catch((e) => console.warn('[take-number] pushToCounterQueue error', (e as Error).message));
    console.log('🎫 [TakeNumber] About to send NEW_TICKET WebSocket notification');
    console.log('🎫 [TakeNumber] Counter ID:', counter.id);
    console.log('🎫 [TakeNumber] Ticket:', ticket.queueNumber);
    
    void this.webSocket.notifyNewTicket(counter.id, ticket)
      .then(() => console.log('✅ [TakeNumber] NEW_TICKET notification sent successfully'))
      .catch((e) => console.warn('❌ [TakeNumber] notifyNewTicket error', (e as Error).message));
    t = tlog('dispatch side-effects (fire-and-forget)', t);

    return {
      success: true,
      ticket: {
        ticketId: ticket.ticketId,
        queueNumber: ticket.queueNumber,
        counterId: ticket.counterId,
        counterCode: ticket.counterCode,
        counterName: ticket.counterName,
        patientName: ticket.patientName,
        patientAge: ticket.patientAge,
        priorityScore: ticket.priorityScore,
        priorityLevel: ticket.priorityLevel,
        estimatedWaitTime: ticket.estimatedWaitTime,
        assignedAt: ticket.assignedAt,
      },
      patientInfo: {
        name: patientInfo.name,
        age: patientInfo.age,
        gender: patientInfo.gender,
        hasAppointment,
        appointmentDetails,
      },
    };
  }

  /**
   * Lấy thông tin bệnh nhân từ mã hồ sơ
   */
  private async getPatientByProfileCode(profileCode: string): Promise<any> {
    const profile = await this.prisma.patientProfile.findFirst({
      where: { profileCode },
      select: {
        name: true,
        gender: true,
        dateOfBirth: true,
        phone: true,
        address: true,
        emergencyContact: true,
        profileCode: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }

    const age = this.calculateAge(profile.dateOfBirth);

    return {
      name: profile.name,
      age,
      gender: profile.gender,
      dateOfBirth: profile.dateOfBirth,
      phone: profile.phone,
      address: profile.address,
      emergencyContact: profile.emergencyContact,
      profileCode: profile.profileCode,
    };
  }

  /**
   * Lấy thông tin bệnh nhân từ mã lịch khám
   */
  private async getPatientByAppointmentCode(appointmentCode: string): Promise<{
    patientInfo: any;
    appointmentDetails: any;
  }> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { appointmentCode },
      select: {
        appointmentCode: true,
        date: true,
        startTime: true,
        endTime: true,
        patientProfile: {
          select: {
            name: true,
            gender: true,
            dateOfBirth: true,
            phone: true,
            address: true,
            emergencyContact: true,
            profileCode: true,
          },
        },
        service: true,
        doctor: true,
        specialty: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Không tìm thấy lịch khám');
    }

    const age = this.calculateAge(appointment.patientProfile.dateOfBirth);

    const patientInfo = {
      name: appointment.patientProfile.name,
      age,
      gender: appointment.patientProfile.gender,
      dateOfBirth: appointment.patientProfile.dateOfBirth,
      phone: appointment.patientProfile.phone,
      address: appointment.patientProfile.address,
      emergencyContact: appointment.patientProfile.emergencyContact,
      profileCode: appointment.patientProfile.profileCode,
    };

    const appointmentDetails = {
      appointmentCode: appointment.appointmentCode,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      service: appointment.service,
      doctor: appointment.doctor,
      specialty: appointment.specialty,
    };

    return { patientInfo, appointmentDetails };
  }

  /**
   * Tính điểm ưu tiên cho bệnh nhân
   */
  private calculatePatientPriority(
    patientInfo: any,
    hasAppointment: boolean,
    appointmentDetails: any,
    request: TakeNumberDto,
  ): number {
    const checkInTime = new Date();
    let appointmentTime: Date | undefined;

    if (hasAppointment && appointmentDetails) {
      // Kết hợp date và startTime để tạo appointmentTime
      const [hours, minutes] = appointmentDetails.startTime.split(':');
      appointmentTime = new Date(appointmentDetails.date);
      appointmentTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    // Xác định các đặc điểm ưu tiên
    const isPregnant = request.isPregnant || this.checkPregnancyFromEmergencyContact(patientInfo.emergencyContact);
    const pregnancyWeeks = this.getPregnancyWeeks(patientInfo.emergencyContact);
    const hasDisability = request.isDisabled || false;
    const isElderly = request.isElderly || patientInfo.age > 70;

    // Sử dụng priority.utils.ts để tính điểm
    let priorityScore = calculatePriorityScore(
      patientInfo.age,
      checkInTime,
      hasAppointment,
      appointmentTime,
      isPregnant,
      pregnancyWeeks,
      hasDisability,
      false, // isFollowUpWithin14Days - cần logic để xác định
      undefined, // lastVisitDate - cần query từ database
      false, // isReturnedAfterService
      patientInfo.gender, // Truyền giới tính để tính ưu tiên cho phụ nữ cao tuổi
    );

    // Thêm điểm cho các đặc điểm đặc biệt
    if (request.isVIP) {
      priorityScore += 8; // Khám VIP có điểm cao
    }

    return priorityScore;
  }

  /**
   * Kiểm tra có thai từ emergency contact
   */
  private checkPregnancyFromEmergencyContact(emergencyContact: any): boolean {
    if (!emergencyContact) return false;
    
    try {
      const contact = typeof emergencyContact === 'string' 
        ? JSON.parse(emergencyContact) 
        : emergencyContact;
      return contact.pregnancyStatus === 'PREGNANT';
    } catch {
      return false;
    }
  }

  /**
   * Lấy số tuần mang thai từ emergency contact
   */
  private getPregnancyWeeks(emergencyContact: any): number | undefined {
    if (!emergencyContact) return undefined;
    
    try {
      const contact = typeof emergencyContact === 'string' 
        ? JSON.parse(emergencyContact) 
        : emergencyContact;
      return contact.pregnancyWeeks;
    } catch {
      return undefined;
    }
  }

  /**
   * Chọn counter tốt nhất dựa trên điểm ưu tiên
   */
  private async selectBestCounter(priorityScore: number): Promise<any> {
    // Lấy tất cả counter có assignment ACTIVE (có nhân viên đang làm việc)
    const counters = await this.prisma.counter.findMany({
      where: { 
        isActive: true,
        assignments: {
          some: {
            status: 'ACTIVE',
            completedAt: null
          }
        }
      },
      include: {
        receptionist: {
          include: {
            auth: true
          }
        },
        assignments: {
          where: {
            status: 'ACTIVE',
            completedAt: null
          },
          orderBy: {
            assignedAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (counters.length === 0) {
      throw new NotFoundException('Không có quầy nào đang có nhân viên tiếp nhận làm việc');
    }

    // Sử dụng tất cả counter có assignment ACTIVE (không cần kiểm tra online status)
    const availableCounters = counters;

    // Ưu tiên counter có ít người đợi nhất
    const sortedCounters = await Promise.all(
      availableCounters.map(async (counter) => {
        const queueLength = await this.redis.getCounterQueueLength(counter.id);
        return { counter, queueLength };
      })
    );

    sortedCounters.sort((a, b) => a.queueLength - b.queueLength);

    // Lấy counter có ít người đợi nhất
    return sortedCounters[0].counter;
  }

  /**
   * Tạo ticket
   */
  private async createTicket(
    patientInfo: any,
    priorityScore: number,
    priorityLevel: string,
    counter: any,
    request: TakeNumberDto,
    hasAppointment: boolean,
    appointmentDetails: any,
  ): Promise<QueueTicket> {
    const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sequence = await this.getNextSequence(counter.id);
    const queueNumber = `${counter.counterCode}-${String(sequence).padStart(3, '0')}`;
    const assignedAt = new Date().toISOString();
    const estimatedWaitTime = this.calculateEstimatedWaitTime(counter.id, priorityScore);

    return {
      ticketId,
      patientProfileCode: patientInfo.profileCode,
      appointmentCode: appointmentDetails?.appointmentCode,
      patientName: patientInfo.name,
      patientAge: patientInfo.age,
      patientGender: patientInfo.gender,
      priorityScore,
      priorityLevel,
      counterId: counter.id,
      counterCode: counter.counterCode,
      counterName: counter.counterName,
      queueNumber,
      sequence,
      assignedAt,
      estimatedWaitTime,
      metadata: {
        isPregnant: request.isPregnant,
        isDisabled: request.isDisabled,
        isElderly: request.isElderly,
        isVIP: request.isVIP,
        notes: request.notes,
        hasAppointment,
      },
    };
  }

  /**
   * Lấy sequence tiếp theo cho counter
   */
  private async getNextSequence(counterId: string): Promise<number> {
    // Sử dụng Redis counter để đảm bảo sequence tăng dần và không duplicate
    return await this.redis.getNextCounterSequence(counterId);
  }

  /**
   * Tính thời gian chờ ước tính
   */
  private calculateEstimatedWaitTime(counterId: string, priorityScore: number): number {
    // Logic tính thời gian chờ dựa trên queue length và điểm ưu tiên
    const baseWaitTime = 15; // 15 phút cơ bản
    const priorityMultiplier = Math.max(0.5, 1 - (priorityScore / 100)); // Điểm cao = chờ ít hơn
    return Math.round(baseWaitTime * priorityMultiplier);
  }

  /**
   * Tính tuổi từ ngày sinh
   */
  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }
}
