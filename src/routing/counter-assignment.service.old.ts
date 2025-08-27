import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { AssignCounterDto } from './dto/assign-counter.dto';
import { ScanInvoiceDto } from './dto/scan-invoice.dto';
import { DirectAssignmentDto } from './dto/direct-assignment.dto';
import { SimpleAssignmentDto } from './dto/simple-assignment.dto';
import { RedisService } from '../cache/redis.service';

export type AssignedCounter = {
  counterId: string;
  counterCode: string;
  counterName: string;
  receptionistId?: string;
  receptionistName?: string;
  priorityScore: number;
  estimatedWaitTime: number; // phút
};

export type CounterStatus = {
  counterId: string;
  counterCode: string;
  counterName: string;
  location?: string;
  isAvailable: boolean;
  currentQueueLength: number;
  averageProcessingTime: number; // phút
  lastAssignedAt?: string;
  receptionistId?: string;
  receptionistName?: string;
  isOnline: boolean;
};

@Injectable()
export class CounterAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaProducerService,
    private readonly redis: RedisService,
  ) {}

  async setCounterOnline(counterId: string): Promise<{ ok: true }> {
    await this.redis.setCounterOnline(counterId, 60);
    return { ok: true };
  }

  async setCounterOffline(counterId: string): Promise<{ ok: true }> {
    await this.redis.setCounterOffline(counterId);
    return { ok: true };
  }

  async clearCounterQueue(counterId: string): Promise<{ ok: true }> {
    await this.redis.clearCounterQueue(counterId);
    return { ok: true };
  }

  async assignReceptionistToCounter(
    counterId: string,
    receptionistId: string,
  ): Promise<{ ok: true }> {
    const counter = await this.prisma.counter.findUnique({
      where: { id: counterId },
    });

    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    const receptionist = await this.prisma.receptionist.findUnique({
      where: { id: receptionistId },
      include: { auth: true },
    });

    if (!receptionist) {
      throw new NotFoundException('Receptionist not found');
    }

    await this.prisma.counter.update({
      where: { id: counterId },
      data: { receptionistId },
    });

    return { ok: true };
  }

  async unassignReceptionistFromCounter(
    counterId: string,
  ): Promise<{ ok: true }> {
    const counter = await this.prisma.counter.findUnique({
      where: { id: counterId },
    });

    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    await this.prisma.counter.update({
      where: { id: counterId },
      data: { receptionistId: null },
    });

    return { ok: true };
  }

  async getCounterQueue(counterId: string): Promise<any[]> {
    return await this.redis.getCounterQueue(counterId);
  }

  async callNextPatient(
    counterId: string,
  ): Promise<{ ok: true; patient?: any }> {
    const queue = await this.redis.getCounterQueue(counterId);

    if (queue.length === 0) {
      return { ok: true };
    }

    const nextPatient = queue[0];

    // Remove from queue using Redis command
    await this.redis['redis'].lpop(`counterQueue:${counterId}`);

    // Publish to Kafka
    const topic =
      process.env.KAFKA_TOPIC_COUNTER_ASSIGNMENTS || 'counter.assignments';
    try {
      await this.kafka.publish(topic, [
        {
          key: counterId,
          value: {
            type: 'NEXT_PATIENT_CALLED',
            counterId,
            patient: nextPatient,
            timestamp: new Date().toISOString(),
          },
        },
      ]);
    } catch (err) {
      console.warn(
        '[Kafka] Next patient call publish failed:',
        (err as Error).message,
      );
    }

    return { ok: true, patient: nextPatient };
  }

  async returnPreviousPatient(counterId: string): Promise<{ ok: true }> {
    // Publish to Kafka
    const topic =
      process.env.KAFKA_TOPIC_COUNTER_ASSIGNMENTS || 'counter.assignments';
    try {
      await this.kafka.publish(topic, [
        {
          key: counterId,
          value: {
            type: 'RETURN_PREVIOUS_PATIENT',
            counterId,
            timestamp: new Date().toISOString(),
          },
        },
      ]);
    } catch (err) {
      console.warn(
        '[Kafka] Return previous patient publish failed:',
        (err as Error).message,
      );
    }

    return { ok: true };
  }

  private calculatePriorityScore(patient: AssignCounterDto): number {
    let score = 0;

    // Ưu tiên cao nhất cho cấp cứu
    if (patient.isEmergency) {
      score += 1000;
    }

    // Ưu tiên cho người cao tuổi (>70)
    if (patient.isElderly || (patient.patientAge && patient.patientAge > 70)) {
      score += 500;
    }

    // Ưu tiên cho phụ nữ có thai
    if (patient.isPregnant) {
      score += 400;
    }

    // Ưu tiên cho người khuyết tật
    if (patient.isDisabled) {
      score += 300;
    }

    // Ưu tiên cho VIP
    if (patient.isVIP) {
      score += 200;
    }

    // Ưu tiên theo độ tuổi (người già hơn)
    if (patient.patientAge) {
      if (patient.patientAge >= 60) score += 100;
      else if (patient.patientAge >= 50) score += 50;
      else if (patient.patientAge >= 40) score += 25;
    }

    // Ưu tiên theo priority level
    switch (patient.priorityLevel) {
      case 'HIGH':
        score += 150;
        break;
      case 'MEDIUM':
        score += 75;
        break;
      case 'LOW':
        score += 25;
        break;
    }

    return score;
  }

  async getAvailableCounters(): Promise<CounterStatus[]> {
    // Lấy danh sách tất cả counters
    const counters = await this.prisma.counter.findMany({
      include: {
        receptionist: {
          include: {
            auth: true,
          },
        },
      },
    });

    const counterStatuses: CounterStatus[] = [];

    for (const counter of counters) {
      const isOnline = await this.redis.isCounterOnline(counter.id);
      const currentQueueLength = await this.redis.getCounterQueueLength(
        counter.id,
      );
      const isAvailable = isOnline && currentQueueLength < counter.maxQueue;
      const averageProcessingTime = 15; // có thể tinh chỉnh theo thực tế

      counterStatuses.push({
        counterId: counter.id,
        counterCode: counter.counterCode,
        counterName: counter.counterName,
        location: counter.location || undefined,
        isAvailable,
        currentQueueLength,
        averageProcessingTime,
        lastAssignedAt: undefined,
        receptionistId: counter.receptionistId || undefined,
        receptionistName: counter.receptionist?.auth?.name || undefined,
        isOnline,
      });
    }

    return counterStatuses;
  }

  async assignPatientToCounter(
    request: AssignCounterDto,
  ): Promise<AssignedCounter> {
    // Verify appointment exists
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: request.appointmentId },
      include: {
        patientProfile: true,
        service: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Verify invoice exists
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: request.invoiceId },
      include: {
        patientProfile: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Lấy thông tin bệnh nhân
    const patientName =
      request.patientName || appointment.patientProfile.name || 'Unknown';

    const patientAge =
      request.patientAge ||
      this.calculateAge(appointment.patientProfile.dateOfBirth);

    // Tính điểm ưu tiên
    const priorityScore = this.calculatePriorityScore({
      ...request,
      patientAge,
    });

    // Lấy danh sách quầy có sẵn (dựa trên online + queue hiện tại)
    const availableCounters = await this.getAvailableCounters();
    const availableReceptionists = availableCounters.filter(
      (c) => c.isAvailable,
    );

    if (availableReceptionists.length === 0) {
      throw new NotFoundException('No available counters at the moment');
    }

    // Chấm điểm và chọn ngẫu nhiên trong các quầy có điểm cao nhất
    let bestScore = -1;
    const scored: Array<{ score: number; counter: CounterStatus }> = [];
    for (const counter of availableReceptionists) {
      const queueScore = Math.max(0, 10 - counter.currentQueueLength) * 10; // Ít hàng đợi = điểm cao hơn
      const processingScore =
        Math.max(0, 30 - counter.averageProcessingTime) * 2; // Xử lý nhanh = điểm cao hơn
      const totalScore = queueScore + processingScore;
      scored.push({ score: totalScore, counter });
      if (totalScore > bestScore) bestScore = totalScore;
    }
    const bestCandidates = scored
      .filter((s) => s.score === bestScore)
      .map((s) => s.counter);
    const bestCounter =
      bestCandidates[Math.floor(Math.random() * bestCandidates.length)];

    // Lấy thông tin counter
    const counter = await this.prisma.counter.findUnique({
      where: { id: bestCounter.counterId },
      include: {
        receptionist: {
          include: { auth: true },
        },
      },
    });

    if (!counter) {
      throw new NotFoundException('Selected counter not found');
    }

    // Tạo assignment
    const assignedCounter: AssignedCounter = {
      counterId: counter.id,
      counterCode: counter.counterCode,
      counterName: counter.counterName,
      receptionistId: counter.receptionistId || undefined,
      receptionistName: counter.receptionist?.auth?.name || undefined,
      priorityScore,
      estimatedWaitTime:
        bestCounter.currentQueueLength * bestCounter.averageProcessingTime,
    };

    // Publish to Kafka
    const topic =
      process.env.KAFKA_TOPIC_COUNTER_ASSIGNMENTS || 'counter.assignments';
    try {
      await this.kafka.publish(topic, [
        {
          key: counter.id,
          value: {
            type: 'PATIENT_ASSIGNED_TO_COUNTER',
            appointmentId: request.appointmentId,
            patientProfileId: request.patientProfileId,
            invoiceId: request.invoiceId,
            patientName,
            patientAge,
            patientGender:
              request.patientGender || appointment.patientProfile.gender,
            priorityScore,
            assignedCounter,
            serviceName: appointment.service.name,
            servicePrice: appointment.service.price,
            timestamp: new Date().toISOString(),
            metadata: {
              isPregnant: request.isPregnant,
              isEmergency: request.isEmergency,
              isElderly: request.isElderly,
              isDisabled: request.isDisabled,
              isVIP: request.isVIP,
              priorityLevel: request.priorityLevel,
              notes: request.notes,
            },
          },
        },
      ]);
    } catch (err) {
      console.warn(
        '[Kafka] Counter assignment publish failed:',
        (err as Error).message,
      );
    }

    // Push to runtime queue (optional for real appointments)
    await this.redis.pushToCounterQueue(counter.id, {
      appointmentId: request.appointmentId,
      patientName,
      priorityScore,
      estimatedWaitTime: assignedCounter.estimatedWaitTime,
      assignedAt: new Date().toISOString(),
    });

    return assignedCounter;
  }

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

  async scanInvoiceAndAssign(request: ScanInvoiceDto): Promise<{
    success: true;
    assignment: AssignedCounter;
    patientInfo: {
      name: string;
      age: number;
      gender: string;
      appointmentDetails: any;
    };
  }> {
    // Tìm hóa đơn
    const invoice = await this.prisma.invoice.findUnique({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: { id: request.invoiceId },
      include: {
        patientProfile: {
          include: {
            patient: {
              include: { auth: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.paymentStatus !== 'PAID') {
      throw new BadRequestException('Invoice must be paid before assignment');
    }

    // Tìm appointment liên quan đến invoice này
    const appointment = await this.prisma.appointment.findFirst({
      where: { invoiceId: request.invoiceId },
      include: {
        patientProfile: {
          include: {
            patient: {
              include: { auth: true },
            },
          },
        },
        service: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found for this invoice');
    }

    // Tính tuổi bệnh nhân
    const patientAge = this.calculateAge(
      appointment.patientProfile.dateOfBirth,
    );
    const patientName =
      appointment.patientProfile.name ||
      appointment.patientProfile.patient?.auth?.name ||
      'Unknown';

    // Tự động xác định các đặc điểm ưu tiên
    const isElderly = patientAge > 70;
    const emergencyContact = appointment.patientProfile
      .emergencyContact as unknown as { pregnancyStatus?: string } | null;
    const isPregnant =
      appointment.patientProfile.gender === 'FEMALE' &&
      emergencyContact?.pregnancyStatus === 'PREGNANT';

    // Tạo request assignment
    const assignmentRequest: AssignCounterDto = {
      appointmentId: appointment.id,
      patientProfileId: appointment.patientProfileId,
      invoiceId: invoice.id,
      patientName,
      patientAge,
      patientGender: appointment.patientProfile.gender,
      isElderly,
      isPregnant,
      isEmergency: false, // Cần logic để xác định
      isDisabled: false, // Cần logic để xác định
      isVIP: false, // Cần logic để xác định
      priorityLevel: isElderly || isPregnant ? 'HIGH' : 'MEDIUM',
      notes: `Scanned by: ${request.scannedBy || 'Unknown'}`,
    };

    // Thực hiện phân bổ (hàm này đã push queue nếu cần)
    const assignment = await this.assignPatientToCounter(assignmentRequest);

    return {
      success: true,
      assignment,
      patientInfo: {
        name: patientName,
        age: patientAge,
        gender: appointment.patientProfile.gender,
        appointmentDetails: {
          serviceName: appointment.service.name,
          servicePrice: appointment.service.price,
          appointmentDate: appointment.date,
          appointmentTime: appointment.startTime,
        },
      },
    };
  }

  async assignDirectPatient(request: DirectAssignmentDto): Promise<{
    success: true;
    assignment: AssignedCounter;
    patientInfo: {
      name: string;
      age: number;
      gender: string;
      serviceName?: string;
      servicePrice?: number;
    };
  }> {
    // Tự động xác định các đặc điểm ưu tiên
    const isElderly = request.isElderly || request.patientAge > 70;
    const isPregnant = request.isPregnant || false;

    // Tính điểm ưu tiên
    const priorityScore = this.calculatePriorityScore({
      appointmentId: `direct-${Date.now()}`,
      patientProfileId: `direct-${Date.now()}`,
      invoiceId: `direct-${Date.now()}`,
      patientName: request.patientName,
      patientAge: request.patientAge,
      patientGender: request.patientGender,
      isElderly,
      isPregnant,
      isEmergency: request.isEmergency || false,
      isDisabled: request.isDisabled || false,
      isVIP: request.isVIP || false,
      priorityLevel:
        request.priorityLevel || (isElderly || isPregnant ? 'HIGH' : 'MEDIUM'),
      notes: `Direct assignment by: ${request.assignedBy || 'Unknown'}`,
    });

    // Lấy danh sách quầy và chọn quầy tốt nhất (dựa trên online + queue)
    const availableCounters = await this.getAvailableCounters();
    const availableReceptionists = availableCounters.filter(
      (c) => c.isAvailable,
    );
    if (availableReceptionists.length === 0) {
      throw new NotFoundException('No available counters at the moment');
    }
    let bestScore = -1;
    const scoredDirect: Array<{ score: number; counter: CounterStatus }> = [];
    for (const counter of availableReceptionists) {
      const queueScore = Math.max(0, 10 - counter.currentQueueLength) * 10;
      const processingScore =
        Math.max(0, 30 - counter.averageProcessingTime) * 2;
      const totalScore = queueScore + processingScore;
      scoredDirect.push({ score: totalScore, counter });
      if (totalScore > bestScore) bestScore = totalScore;
    }
    const bestDirectCandidates = scoredDirect
      .filter((s) => s.score === bestScore)
      .map((s) => s.counter);
    const bestCounter =
      bestDirectCandidates[
        Math.floor(Math.random() * bestDirectCandidates.length)
      ];

    // Lấy thông tin receptionist
    const receptionist = await this.prisma.receptionist.findUnique({
      where: { id: bestCounter.counterId },
      include: { auth: true },
    });
    if (!receptionist) {
      throw new NotFoundException('Selected receptionist not found');
    }

    // Tạo assignment
    const assignment: AssignedCounter = {
      counterId: receptionist.id,
      counterCode: `CTR${receptionist.id.slice(-6)}`,
      counterName: `Counter ${receptionist.auth.name}`,
      receptionistId: receptionist.id,
      receptionistName: receptionist.auth.name,
      priorityScore,
      estimatedWaitTime:
        bestCounter.currentQueueLength * bestCounter.averageProcessingTime,
    };

    // Publish to Kafka
    const topic =
      process.env.KAFKA_TOPIC_COUNTER_ASSIGNMENTS || 'counter.assignments';
    try {
      await this.kafka.publish(topic, [
        {
          key: receptionist.id,
          value: {
            type: 'PATIENT_ASSIGNED_TO_COUNTER',
            appointmentId: `direct-${Date.now()}`,
            patientProfileId: `direct-${Date.now()}`,
            invoiceId: `direct-${Date.now()}`,
            patientName: request.patientName,
            patientAge: request.patientAge,
            patientGender: request.patientGender,
            priorityScore,
            assignedCounter: assignment,
            serviceName: request.serviceName,
            servicePrice: request.servicePrice,
            timestamp: new Date().toISOString(),
            metadata: {
              isPregnant,
              isEmergency: request.isEmergency || false,
              isElderly,
              isDisabled: request.isDisabled || false,
              isVIP: request.isVIP || false,
              priorityLevel:
                request.priorityLevel ||
                (isElderly || isPregnant ? 'HIGH' : 'MEDIUM'),
              notes: `Direct assignment by: ${request.assignedBy || 'Unknown'}`,
            },
          },
        },
      ]);
    } catch (err) {
      console.warn(
        '[Kafka] Counter direct assignment publish failed:',
        (err as Error).message,
      );
    }

    // Push runtime queue entry
    await this.redis.pushToCounterQueue(receptionist.id, {
      appointmentId: `direct-${Date.now()}`,
      patientName: request.patientName,
      priorityScore,
      estimatedWaitTime: assignment.estimatedWaitTime,
      assignedAt: new Date().toISOString(),
    });

    return {
      success: true,
      assignment,
      patientInfo: {
        name: request.patientName,
        age: request.patientAge,
        gender: request.patientGender,
        serviceName: request.serviceName,
        servicePrice: request.servicePrice,
      },
    };
  }

  async assignSimplePatient(request: SimpleAssignmentDto): Promise<{
    success: true;
    assignment: AssignedCounter;
    queueNumber: string;
  }> {
    // Tạo số thứ tự
    const queueNumber = `Q${Date.now().toString().slice(-6)}`;

    const generatedAppointmentId = `simple-${Date.now()}`;
    const generatedProfileId = `simple-${Date.now()}`;
    const patientName = `Bệnh nhân ${queueNumber}`;
    const patientAge = 30;
    const patientGender = 'MALE';

    // Điểm ưu tiên thấp nhất cho bốc số đơn thuần
    const priorityScore = this.calculatePriorityScore({
      appointmentId: generatedAppointmentId,
      patientProfileId: generatedProfileId,
      invoiceId: `simple-${Date.now()}`,
      patientName,
      patientAge,
      patientGender,
      isElderly: false,
      isPregnant: false,
      isEmergency: false,
      isDisabled: false,
      isVIP: false,
      priorityLevel: 'LOW',
      notes: `Simple assignment - Queue number: ${queueNumber} by: ${request.assignedBy || 'Unknown'}`,
    });

    // Lấy danh sách quầy có sẵn và chọn quầy tốt nhất (dựa trên online + queue)
    const availableCounters = await this.getAvailableCounters();
    const availableReceptionists = availableCounters.filter(
      (c) => c.isAvailable,
    );
    if (availableReceptionists.length === 0) {
      throw new NotFoundException('No available counters at the moment');
    }
    let bestScore = -1;
    const scoredSimple: Array<{ score: number; counter: CounterStatus }> = [];
    for (const counter of availableReceptionists) {
      const queueScore = Math.max(0, 10 - counter.currentQueueLength) * 10;
      const processingScore =
        Math.max(0, 30 - counter.averageProcessingTime) * 2;
      const totalScore = queueScore + processingScore;
      scoredSimple.push({ score: totalScore, counter });
      if (totalScore > bestScore) bestScore = totalScore;
    }
    const bestSimpleCandidates = scoredSimple
      .filter((s) => s.score === bestScore)
      .map((s) => s.counter);
    const bestCounter =
      bestSimpleCandidates[
        Math.floor(Math.random() * bestSimpleCandidates.length)
      ];

    // Lấy thông tin receptionist
    const receptionist = await this.prisma.receptionist.findUnique({
      where: { id: bestCounter.counterId },
      include: { auth: true },
    });
    if (!receptionist) {
      throw new NotFoundException('Selected receptionist not found');
    }

    const assignment: AssignedCounter = {
      counterId: receptionist.id,
      counterCode: `CTR${receptionist.id.slice(-6)}`,
      counterName: `Counter ${receptionist.auth.name}`,
      receptionistId: receptionist.id,
      receptionistName: receptionist.auth.name,
      priorityScore,
      estimatedWaitTime:
        bestCounter.currentQueueLength * bestCounter.averageProcessingTime,
    };

    // Publish to Kafka
    const topic =
      process.env.KAFKA_TOPIC_COUNTER_ASSIGNMENTS || 'counter.assignments';
    try {
      await this.kafka.publish(topic, [
        {
          key: receptionist.id,
          value: {
            type: 'PATIENT_ASSIGNED_TO_COUNTER',
            appointmentId: generatedAppointmentId,
            patientProfileId: generatedProfileId,
            invoiceId: `simple-${Date.now()}`,
            patientName,
            patientAge,
            patientGender,
            priorityScore,
            assignedCounter: assignment,
            timestamp: new Date().toISOString(),
            metadata: {
              isPregnant: false,
              isEmergency: false,
              isElderly: false,
              isDisabled: false,
              isVIP: false,
              priorityLevel: 'LOW',
              notes: `Simple assignment - Queue number: ${queueNumber} by: ${request.assignedBy || 'Unknown'}`,
            },
          },
        },
      ]);
    } catch (err) {
      console.warn(
        '[Kafka] Counter simple assignment publish failed:',
        (err as Error).message,
      );
    }

    // Push runtime queue entry
    await this.redis.pushToCounterQueue(receptionist.id, {
      appointmentId: generatedAppointmentId,
      patientName,
      priorityScore,
      estimatedWaitTime: assignment.estimatedWaitTime,
      assignedAt: new Date().toISOString(),
    });

    return {
      success: true,
      assignment,
      queueNumber,
    };
  }
}
