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
import { TicketStatus } from '../cache/redis-stream.service';

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
    assignedAt: string;
    isOnTime?: boolean;
    isPregnant?: boolean;
    isDisabled?: boolean;
    isElderly?: boolean;
    isChild?: boolean;
    status: TicketStatus;
    callCount: number;
    queuePriority: number;
    metadata?: Record<string, any>;
  };
  patientInfo: {
    name: string;
    age: number;
    gender: string;
    profileCode?: string;
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

    // Tìm thông tin bệnh nhân từ mã hồ sơ, mã lịch khám, hoặc số điện thoại
    // QUAN TRỌNG: Nếu có appointmentCode, luôn ưu tiên lấy từ appointment để có appointmentDetails
    if (request.appointmentCode) {
      const result = await this.withTimeout(
        this.getPatientByAppointmentCode(request.appointmentCode),
        500,
        () => ({ patientInfo: null as any, appointmentDetails: null as any }),
      );
      patientInfo = result.patientInfo;
      hasAppointment = true;
      appointmentDetails = result.appointmentDetails;
    } else if (request.patientProfileCode) {
      patientInfo = await this.withTimeout(
        this.getPatientByProfileCode(request.patientProfileCode),
        500,
        () => null,
      );
    } else if (request.patientPhone) {
      // Tìm PatientProfile theo số điện thoại
      patientInfo = await this.withTimeout(
        this.getPatientByPhone(request.patientPhone),
        500,
        () => null,
      );
    }
    t = tlog('patient lookup', t);

    // Nếu không tìm thấy thông tin từ mã, sử dụng thông tin từ request
    if (!patientInfo) {
      if (!request.patientName) {
        throw new BadRequestException('Không tìm thấy thông tin bệnh nhân. Vui lòng cung cấp tên bệnh nhân.');
      }

      // Ưu tiên sử dụng patientAge từ request nếu có
      let patientAge: number;
      let dateOfBirth: Date;

      if (typeof request.patientAge === 'number' && request.patientAge >= 0 && request.patientAge <= 150) {
        // Nếu có patientAge, tính ngược lại dateOfBirth
        patientAge = request.patientAge;
        const nowYear = new Date().getFullYear();
        const birthYear = nowYear - patientAge;
        dateOfBirth = new Date(birthYear, 0, 1);
      } else {
        // Nếu không có patientAge, dùng birthYear hoặc mặc định
        const nowYear = new Date().getFullYear();
        const birthYear = typeof request.birthYear === 'number'
          ? Math.min(Math.max(request.birthYear, 1900), nowYear)
          : undefined;
        dateOfBirth = birthYear
          ? new Date(birthYear, 0, 1)
          : new Date(1990, 0, 1);
        patientAge = this.calculateAge(dateOfBirth);
      }

      patientInfo = {
        name: request.patientName,
        age: patientAge,
        gender: 'UNKNOWN',
        dateOfBirth: dateOfBirth,
      };
    } else {
      // Nếu có patientInfo từ database nhưng request có patientAge, ưu tiên dùng request.patientAge
      if (typeof request.patientAge === 'number' && request.patientAge >= 0 && request.patientAge <= 150) {
        patientInfo.age = request.patientAge;
        // Cập nhật dateOfBirth để phù hợp với age mới
        const nowYear = new Date().getFullYear();
        const birthYear = nowYear - request.patientAge;
        patientInfo.dateOfBirth = new Date(birthYear, 0, 1);
      }
    }

    // Xác định thông tin ưu tiên (mang thai/khuyết tật/người già) dựa trên hồ sơ nếu có
    let isPregnant = request.isPregnant ?? false;
    let isDisabled = request.isDisabled ?? false;
    let isElderly = request.isElderly ?? false;

    // Nếu không có isElderly từ request, tính từ age
    if (!isElderly && typeof patientInfo.age === 'number' && patientInfo.age >= 75) {
      isElderly = true;
    }

    if (patientInfo && typeof patientInfo.isPregnant === 'boolean') {
      isPregnant = patientInfo.isPregnant;
    }

    if (patientInfo && typeof patientInfo.isDisabled === 'boolean') {
      isDisabled = patientInfo.isDisabled;
    }

    patientInfo = {
      ...patientInfo,
      isPregnant,
      isDisabled,
      isElderly,
    };

    // Tính toán xem bệnh nhân có đến đúng giờ không
    const isOnTime = this.calculateIsOnTime(hasAppointment, appointmentDetails);
    t = tlog('calculate on-time status', t);

    // Chọn counter phù hợp (có thể filter theo VIP)
    // Hỗ trợ cả isVip và isVIP (chữ hoa)
    const isVip = (request.isVip === true) || ((request as any).isVIP === true);
    console.log(`[takeNumber] Request isVip: ${request.isVip}, isVIP: ${(request as any).isVIP}, processed isVip: ${isVip}`);
    const counter = await this.selectBestCounter(isVip);
    t = tlog('select counter', t);

    // Tính toán priority score cho queue
    const queuePriority = this.calculateQueuePriority(
      patientInfo.age,
      isDisabled,
      isPregnant,
      hasAppointment,
      0, // Sẽ được cập nhật sau khi có sequence
      0, // callCount = 0 cho bệnh nhân mới
      TicketStatus.WAITING, // status ban đầu
    );

    // Tạo ticket
    const ticket = await this.createTicket(
      patientInfo,
      counter,
      request,
      appointmentDetails,
      isOnTime,
      queuePriority,
      { isDisabled, isPregnant, isElderly },
    );
    t = tlog('create ticket', t);

    // Thực hiện song song: lưu stream, enqueue ZSET, notify WS
    const enqueueItem: any = {
      ...ticket,
      status: TicketStatus.WAITING,
      callCount: 0,
    };
    
    // Lấy queue trước khi thêm bệnh nhân mới
    const oldQueue = await this.getCurrentQueue(counter.id);
    
    // Thực thi nền để không chặn response nếu Redis/WebSocket chậm
    void this.redisStream.addTicketToStream(ticket)
      .catch((e) => console.warn('[take-number] addTicketToStream error', (e as Error).message));
    void this.redis.pushToCounterQueue(counter.id, enqueueItem)
      .catch((e) => console.warn('[take-number] pushToCounterQueue error', (e as Error).message));
    console.log('🎫 [TakeNumber] About to send NEW_TICKET WebSocket notification');
    console.log('🎫 [TakeNumber] Counter ID:', counter.id);
    console.log('🎫 [TakeNumber] Ticket:', ticket.queueNumber);
    
    void this.webSocket.notifyNewTicket(counter.id, ticket)
      .catch((e) => console.warn('[take-number] notifyNewTicket error', (e as Error).message));
    
    // Gửi sự kiện WebSocket về thay đổi queue
    void this.notifyNewTicketQueueChanges(counter.id, oldQueue, ticket)
      .catch((e) => console.warn('[take-number] notifyNewTicketQueueChanges error', (e as Error).message));
    
    t = tlog('dispatch side-effects (fire-and-forget)', t);

    const frontendTicket = this.enrichTicketForFrontend(ticket);

    return {
      success: true,
      ticket: frontendTicket,
      patientInfo: {
        name: patientInfo.name,
        age: patientInfo.age,
        gender: patientInfo.gender,
        profileCode: patientInfo.profileCode,
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
        isPregnant: true,
        isDisabled: true,
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
      isPregnant: profile.isPregnant,
      isDisabled: profile.isDisabled,
    };
  }

  /**
   * Lấy thông tin bệnh nhân từ số điện thoại
   */
  private async getPatientByPhone(phone: string): Promise<any> {
    // Tìm PatientProfile theo số điện thoại (lấy profile mới nhất nếu có nhiều)
    const profile = await this.prisma.patientProfile.findFirst({
      where: { 
        phone: {
          contains: phone,
        },
        isActive: true,
      },
      select: {
        name: true,
        gender: true,
        dateOfBirth: true,
        phone: true,
        address: true,
        emergencyContact: true,
        profileCode: true,
        isPregnant: true,
        isDisabled: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!profile) {
      return null;
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
      isPregnant: profile.isPregnant,
      isDisabled: profile.isDisabled,
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
            isPregnant: true,
            isDisabled: true,
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
      isPregnant: appointment.patientProfile.isPregnant,
      isDisabled: appointment.patientProfile.isDisabled,
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
   * Parse QR code để lấy mã hồ sơ hoặc mã lịch khám
   */
  private async parseQrCode(qrCode: string): Promise<{
    type: 'profile' | 'appointment';
    code: string;
  }> {
    try {
      const obj = JSON.parse(qrCode);
      if (obj.profileCode) {
        return { type: 'profile', code: obj.profileCode };
      }
      if (obj.appointmentCode) {
        return { type: 'appointment', code: obj.appointmentCode };
      }
    } catch {
      // Fallback to regex
    }

    // Thử tìm mã hồ sơ (format: PP-XXXXXX)
    const profileMatch = qrCode.match(/PP-\d{6}/);
    if (profileMatch) {
      return { type: 'profile', code: profileMatch[0] };
    }

    // Thử tìm mã lịch khám (format: AP-XXXXXX)
    const appointmentMatch = qrCode.match(/AP-\d{6}/);
    if (appointmentMatch) {
      return { type: 'appointment', code: appointmentMatch[0] };
    }

    throw new BadRequestException('QR code không hợp lệ');
  }


  /**
   * Chọn counter tốt nhất
   * @param isVip - Nếu true, chỉ chọn các counter có isVip = true. Nếu false/null, chọn counter bình thường (isVip = null/false)
   */
  private async selectBestCounter(isVip: boolean = false): Promise<any> {
    // Query tất cả assignment ACTIVE trước, sau đó filter trong code để đảm bảo chính xác
    const allAssignments = await this.prisma.counterAssignment.findMany({
      where: {
        status: 'ACTIVE',
        completedAt: null,
      },
      select: {
        counterId: true,
        isVip: true,
        counter: {
          select: {
            id: true,
            counterCode: true,
            counterName: true,
            isActive: true,
          },
        },
      },
    });

    console.log(`[selectBestCounter] isVip=${isVip}, found ${allAssignments.length} active assignments`);
    allAssignments.forEach(a => {
      console.log(`[selectBestCounter] Assignment: counterId=${a.counterId}, isVip=${a.isVip}, counterCode=${a.counter.counterCode}, isActive=${a.counter.isActive}`);
    });

    // Filter theo isVip trong code để đảm bảo chính xác
    const filteredAssignments = allAssignments.filter(assignment => {
      if (!assignment.counter.isActive) {
        return false;
      }

      if (isVip) {
        // Nếu là VIP, CHỈ lấy assignment có isVip === true (strict check)
        return assignment.isVip === true;
      } else {
        // Nếu không phải VIP, chỉ lấy assignment có isVip === null hoặc isVip === false
        return assignment.isVip === null || assignment.isVip === false;
      }
    });

    console.log(`[selectBestCounter] After filtering: ${filteredAssignments.length} assignments`);

    if (filteredAssignments.length === 0) {
      if (isVip) {
        throw new BadRequestException('Chưa có quầy khám dịch vụ nào đang mở');
      }
      throw new NotFoundException('Không có counter nào đang hoạt động với nhân viên được phân công');
    }

    // Loại bỏ duplicate counter (một counter có thể có nhiều assignment)
    const counterMap = new Map<string, any>();
    for (const assignment of filteredAssignments) {
      counterMap.set(assignment.counter.id, assignment.counter);
    }

    const counters = Array.from(counterMap.values());
    console.log(`[selectBestCounter] Unique counters: ${counters.length}`);

    // Ưu tiên counter có ít người đợi nhất
    const sortedCounters = await Promise.all(
      counters.map(async (counter) => {
        const queueLength = await this.redis.getCounterQueueLength(counter.id);
        return { counter, queueLength };
      })
    );

    sortedCounters.sort((a, b) => a.queueLength - b.queueLength);

    // Lấy counter có ít người đợi nhất
    const selectedCounter = sortedCounters[0].counter;
    console.log(`[selectBestCounter] Selected counter: ${selectedCounter.counterCode}, queueLength=${sortedCounters[0].queueLength}, isVip=${isVip}`);
    return selectedCounter;
  }

  /**
   * Tạo ticket
   */
  private async createTicket(
    patientInfo: any,
    counter: any,
    request: TakeNumberDto,
    appointmentDetails: any,
    isOnTime: boolean,
    queuePriority: number,
    priorityFlags: { isDisabled: boolean; isPregnant: boolean; isElderly: boolean },
  ): Promise<QueueTicket> {
    const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sequence = await this.getNextSequence(counter.id);
    const queueNumber = `${counter.counterCode}-${String(sequence).padStart(3, '0')}`;
    const assignedAt = new Date().toISOString();

    // Tính lại priority score với sequence thực tế
    const finalQueuePriority = this.calculateQueuePriority(
      patientInfo.age,
      priorityFlags.isDisabled,
      priorityFlags.isPregnant,
      !!appointmentDetails,
      sequence,
      0, // callCount = 0 cho bệnh nhân mới
      TicketStatus.WAITING, // status ban đầu
    );

    // Tạo metadata với thông tin appointment và patient profile
    const metadata: Record<string, any> = {
      isPregnant: priorityFlags.isPregnant,
      isDisabled: priorityFlags.isDisabled,
      isElderly: priorityFlags.isElderly,
      isChild: typeof patientInfo.age === 'number' ? patientInfo.age < 6 : false,
    };
    
    // Thêm patientProfileCode vào metadata
    if (patientInfo.profileCode) {
      metadata.patientProfileCode = patientInfo.profileCode;
    }
    
    // Thêm thông tin appointment vào metadata để frontend có thể nhận diện
    if (appointmentDetails) {
      metadata.hasAppointment = true;
      metadata.appointmentCode = appointmentDetails.appointmentCode;
      metadata.appointmentDetails = appointmentDetails;
    }

    return {
      ticketId,
      patientProfileCode: patientInfo.profileCode,
      appointmentCode: appointmentDetails?.appointmentCode,
      patientName: patientInfo.name,
      patientAge: patientInfo.age,
      patientGender: patientInfo.gender,
      counterId: counter.id,
      counterCode: counter.counterCode,
      counterName: counter.counterName,
      queueNumber,
      sequence,
      assignedAt,
      isOnTime,
      status: TicketStatus.WAITING,
      callCount: 0,
      queuePriority: finalQueuePriority,
      metadata,
    };
  }

  /**
   * Tính toán xem bệnh nhân có đến đúng giờ không
   */
  private calculateIsOnTime(hasAppointment: boolean, appointmentDetails: any): boolean {
    if (!hasAppointment || !appointmentDetails) {
      return false; // Không có lịch hẹn thì không tính là đúng giờ
    }

    const checkInTime = new Date();
    const [hours, minutes] = appointmentDetails.startTime.split(':');
    const appointmentTime = new Date(appointmentDetails.date);
    appointmentTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Tính khoảng cách thời gian (tính bằng phút)
    const timeDifferenceMinutes = Math.abs(
      (checkInTime.getTime() - appointmentTime.getTime()) / (1000 * 60)
    );

    // Đúng giờ nếu trong khoảng ±20 phút
    return timeDifferenceMinutes <= 20;
  }

  /**
   * Tính toán priority score cho việc sắp xếp queue
   * Thứ tự ưu tiên: 1. Đang phục vụ 2. Tiếp theo 3. Miss (1) 4. Miss (2) 5. Miss (3) ... 6. Già (>75) 7. Trẻ em (<6) 8. Khuyết tật 9. Mang thai 10. Có lịch hẹn 11. Thường
   */
  private calculateQueuePriority(
    patientAge: number,
    isDisabled: boolean,
    isPregnant: boolean,
    hasAppointment: boolean,
    sequence: number,
    callCount: number = 0,
    status: TicketStatus = TicketStatus.WAITING,
  ): number {
    let priorityScore = 0;

    // 1. Đang phục vụ (SERVING) - ưu tiên cao nhất
    if (status === TicketStatus.SERVING) {
      return 0;
    }
    
    // 2. Tiếp theo (NEXT) - ưu tiên cao thứ 2
    if (status === TicketStatus.NEXT) {
      return 100000;
    }
    
    // 3. Miss patients - ưu tiên theo callCount (ai gọi nhiều lần hơn thì trôi về sau)
    if (status === TicketStatus.SKIPPED) {
      return 200000 + (callCount * 10000); // callCount cao hơn = priority thấp hơn
    }

    // 4. Người già (>75 tuổi) - ưu tiên cao thứ 4
    if (patientAge > 75) {
      priorityScore = 10000000 - patientAge; // Người già hơn ưu tiên hơn
    }
    // 5. Trẻ em (<6 tuổi) - ưu tiên cao thứ 5
    else if (patientAge < 6) {
      priorityScore = 20000000 - patientAge; // Trẻ em nhỏ hơn ưu tiên hơn
    }
    // 6. Người khuyết tật - ưu tiên cao thứ 6
    else if (isDisabled) {
      priorityScore = 30000000;
    }
    // 7. Người mang thai - ưu tiên cao thứ 7
    else if (isPregnant) {
      priorityScore = 40000000;
    }
    // 8. Người có lịch hẹn - ưu tiên cao thứ 8
    else if (hasAppointment) {
      priorityScore = 50000000;
    }
    // 9. Người thường - ưu tiên thấp nhất
    else {
      priorityScore = 60000000;
    }

    // Trong cùng nhóm ưu tiên, ai đến trước (sequence nhỏ hơn) thì ưu tiên hơn
    return priorityScore + sequence;
  }

  /**
   * Lấy sequence tiếp theo cho counter
   */
  private async getNextSequence(counterId: string): Promise<number> {
    // Sử dụng Redis counter thực tế
    return await this.redis.getNextCounterSequence(counterId);
  }


  /**
   * Lấy queue hiện tại
   */
  private async getCurrentQueue(counterId: string): Promise<any[]> {
    try {
      const queueKey = `counterQueueZ:${counterId}`;
      const members = await this.redis['redis'].zrevrange(queueKey, 0, -1);
      return members.map(member => {
        try {
          return JSON.parse(member);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.warn('Error getting current queue:', error);
      return [];
    }
  }

  /**
   * Gửi sự kiện WebSocket về thay đổi queue khi có bệnh nhân mới
   */
  private async notifyNewTicketQueueChanges(
    counterId: string,
    oldQueue: any[],
    newTicket: any,
  ): Promise<void> {
    try {
      // Đợi một chút để Redis được cập nhật
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const newQueue = await this.getCurrentQueue(counterId);
      await this.logQueueSnapshot(counterId, newQueue, 'After enqueue new ticket');
      
      const changes = {
        newPatients: [newTicket] as any[],
        movedPatients: [] as any[],
        removedPatients: [] as any[],
        currentServing: newQueue.find(p => p.status === 'SERVING') as any,
        currentNext: newQueue.find(p => p.status === 'NEXT') as any,
      };

      // Tìm bệnh nhân bị chen lên (có priority thấp hơn bệnh nhân mới)
      for (const patient of newQueue) {
        if (patient.ticketId !== newTicket.ticketId && patient.queuePriority > newTicket.queuePriority) {
          changes.movedPatients.push({
            ...patient,
            reason: 'pushed_down_by_new_patient',
            newPatientTicketId: newTicket.ticketId,
          } as any);
        }
      }

      await this.webSocket.notifyQueuePositionChanges(counterId, 'NEW_TICKET', changes);
      console.log(`[WebSocket] Sent new ticket queue changes to counter ${counterId}`);
    } catch (error) {
      console.warn('Error notifying new ticket queue changes:', error);
    }
  }

  /**
   * In thông tin queue hiện tại dạng bảng để debug khi test
   */
  private async logQueueSnapshot(counterId: string, queue: any[], context: string): Promise<void> {
    if (!Array.isArray(queue)) {
      console.log(`[queue-debug] ${context} - counter ${counterId}: queue unavailable`);
      return;
    }

    const current = await this.redis.getCurrentPatient(counterId);
    const combined = [] as any[];

    if (current) {
      const normalizedCurrent = {
        ...current,
        status: TicketStatus.SERVING,
      };
      combined.push(normalizedCurrent);
    }

    for (const ticket of queue) {
      if (current && ticket.ticketId === (current as any).ticketId) {
        continue;
      }
      combined.push(ticket);
    }

    const rows = combined.map((ticket, index) => ({
      pos: index + 1,
      ticket: ticket.ticketId,
      qNum: ticket.queueNumber,
      name: ticket.patientName,
      arr: typeof ticket.assignedAt === 'string'
        ? (ticket.assignedAt.split('T')[1]?.slice(0, 8) || ticket.assignedAt)
        : '',
      st: ticket.status,
      stLbl: ticket.statusText || ticket.statusLabel || '',
      prio: ticket.queuePriority,
      calls: ticket.callCount ?? 0,
      age: ticket.patientAge,
      preg: ticket.metadata?.isPregnant ? 'Y' : '',
      dis: ticket.metadata?.isDisabled ? 'Y' : '',
      eld: ticket.patientAge > 75 ? 'Y' : '',
      chd: (ticket.patientAge < 6 || ticket.metadata?.isChild) ? 'Y' : '',
    }));

    console.log(`[queue-debug] ${context} - counter ${counterId}`);
    if (rows.length > 0) {
      console.table(rows);
    } else {
      console.log('[queue-debug] Queue is currently empty');
    }
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

  private enrichTicketForFrontend(ticket: QueueTicket): any {
    const metadata = ticket.metadata || {};
    const age = typeof ticket.patientAge === 'number' ? ticket.patientAge : undefined;

    // Ưu tiên dùng isElderly từ metadata (từ request), nếu không có thì tính từ age
    const isElderly = typeof metadata.isElderly === 'boolean'
      ? metadata.isElderly
      : (typeof age === 'number' ? age >= 75 : false);

    return {
      ...ticket,
      metadata,
      isOnTime: Boolean(ticket.isOnTime),
      isPregnant: Boolean(metadata.isPregnant),
      isDisabled: Boolean(metadata.isDisabled),
      isElderly,
      isChild: typeof age === 'number' ? age < 6 : Boolean(metadata.isChild),
    };
  }
}
