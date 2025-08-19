import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { AssignCounterDto } from './dto/assign-counter.dto';
import { ScanInvoiceDto } from './dto/scan-invoice.dto';
import { DirectAssignmentDto } from './dto/direct-assignment.dto';
import { SimpleAssignmentDto } from './dto/simple-assignment.dto';

export type AssignedCounter = {
  counterId: string;
  counterCode: string;
  counterName: string;
  receptionistId: string;
  receptionistName: string;
  priorityScore: number;
  estimatedWaitTime: number; // phút
};

export type CounterStatus = {
  counterId: string;
  isAvailable: boolean;
  currentQueueLength: number;
  averageProcessingTime: number; // phút
  lastAssignedAt?: string;
};

@Injectable()
export class CounterAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaProducerService,
  ) {}

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
    // Lấy danh sách tất cả receptionist (quầy)
    const receptionists = await this.prisma.receptionist.findMany({
      include: {
        auth: true,
      },
      where: {
        auth: {
          isActive: true,
        },
      },
    });

    const counterStatuses: CounterStatus[] = [];

    for (const receptionist of receptionists) {
      // Tính toán trạng thái quầy dựa trên lịch sử gần đây
      const recentAssignments = await this.prisma.appointment.findMany({
        where: {
          bookerId: receptionist.authId,
          status: {
            in: ['IN_PROGRESS', 'WAITING'],
          },
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)), // Hôm nay
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      });

      const isAvailable = recentAssignments.length < 5; // Giả sử mỗi quầy tối đa 5 bệnh nhân
      const currentQueueLength = recentAssignments.length;
      
      // Tính thời gian xử lý trung bình (giả định)
      const averageProcessingTime = 15; // 15 phút

      counterStatuses.push({
        counterId: receptionist.id,
        isAvailable,
        currentQueueLength,
        averageProcessingTime,
        lastAssignedAt: recentAssignments[0]?.createdAt?.toISOString(),
      });
    }

    return counterStatuses;
  }

  async assignPatientToCounter(request: AssignCounterDto): Promise<AssignedCounter> {
    // Verify appointment exists
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: request.appointmentId },
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
      throw new NotFoundException('Appointment not found');
    }

    // Verify invoice exists
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: request.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Lấy thông tin bệnh nhân
    const patientName = request.patientName || 
      (appointment.patientProfile.name && appointment.patientProfile.name.trim().length > 0
        ? appointment.patientProfile.name
        : appointment.patientProfile.patient?.auth?.name ?? 'Unknown');

    const patientAge = request.patientAge || 
      this.calculateAge(appointment.patientProfile.dateOfBirth);

    // Tính điểm ưu tiên
    const priorityScore = this.calculatePriorityScore({
      ...request,
      patientAge,
    });

    // Lấy danh sách quầy có sẵn
    const availableCounters = await this.getAvailableCounters();
    const availableReceptionists = availableCounters.filter(c => c.isAvailable);

    if (availableReceptionists.length === 0) {
      throw new NotFoundException('No available counters at the moment');
    }

    // Chọn quầy tốt nhất dựa trên:
    // 1. Điểm ưu tiên của bệnh nhân
    // 2. Độ dài hàng đợi hiện tại
    // 3. Thời gian xử lý trung bình
    let bestCounter = availableReceptionists[0];
    let bestScore = -1;

    for (const counter of availableReceptionists) {
      // Tính điểm cho quầy này
      const queueScore = Math.max(0, 10 - counter.currentQueueLength) * 10; // Ít hàng đợi = điểm cao hơn
      const processingScore = Math.max(0, 30 - counter.averageProcessingTime) * 2; // Xử lý nhanh = điểm cao hơn
      const totalScore = queueScore + processingScore;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestCounter = counter;
      }
    }

    // Lấy thông tin receptionist
    const receptionist = await this.prisma.receptionist.findUnique({
      where: { id: bestCounter.counterId },
      include: { auth: true },
    });

    if (!receptionist) {
      throw new NotFoundException('Selected receptionist not found');
    }

    // Tạo assignment
    const assignedCounter: AssignedCounter = {
      counterId: receptionist.id,
      counterCode: `CTR${receptionist.id.slice(-6)}`,
      counterName: `Counter ${receptionist.auth.name}`,
      receptionistId: receptionist.id,
      receptionistName: receptionist.auth.name,
      priorityScore,
      estimatedWaitTime: bestCounter.currentQueueLength * bestCounter.averageProcessingTime,
    };

    // Publish to Kafka
    const topic = process.env.KAFKA_TOPIC_COUNTER_ASSIGNMENTS || 'counter.assignments';
    try {
      await this.kafka.publish(topic, [
        {
          key: receptionist.id,
          value: {
            type: 'PATIENT_ASSIGNED_TO_COUNTER',
            appointmentId: request.appointmentId,
            patientProfileId: request.patientProfileId,
            invoiceId: request.invoiceId,
            patientName,
            patientAge,
            patientGender: request.patientGender || appointment.patientProfile.gender,
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
              specialNeeds: request.specialNeeds,
              priorityLevel: request.priorityLevel,
              notes: request.notes,
            },
          },
        },
      ]);
    } catch (err) {
      console.warn('[Kafka] Counter assignment publish failed:', (err as Error).message);
    }

    return assignedCounter;
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  async getCounterQueue(counterId: string): Promise<{
    counterId: string;
    receptionistName: string;
    currentQueue: Array<{
      appointmentId: string;
      patientName: string;
      priorityScore: number;
      estimatedWaitTime: number;
      assignedAt: string;
    }>;
  }> {
    const receptionist = await this.prisma.receptionist.findUnique({
      where: { id: counterId },
      include: { auth: true },
    });

    if (!receptionist) {
      throw new NotFoundException('Counter not found');
    }

    // Lấy danh sách bệnh nhân đang chờ tại quầy này
    const queue = await this.prisma.appointment.findMany({
      where: {
        bookerId: receptionist.authId,
        status: {
          in: ['IN_PROGRESS', 'WAITING'],
        },
        date: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      include: {
        patientProfile: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      counterId,
      receptionistName: receptionist.auth.name,
      currentQueue: queue.map((appointment, index) => ({
        appointmentId: appointment.id,
        patientName: appointment.patientProfile.name,
        priorityScore: 0, // Cần tính toán lại dựa trên thông tin bệnh nhân
        estimatedWaitTime: (index + 1) * 15, // Ước tính 15 phút mỗi bệnh nhân
        assignedAt: appointment.createdAt.toISOString(),
      })),
    };
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
      where: { id: request.invoiceId },
      include: {
        appointment: {
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
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'PAID') {
      throw new BadRequestException('Invoice must be paid before assignment');
    }

    const appointment = invoice.appointment;
    if (!appointment) {
      throw new NotFoundException('Appointment not found for this invoice');
    }

    // Tính tuổi bệnh nhân
    const patientAge = this.calculateAge(appointment.patientProfile.dateOfBirth);
    const patientName = appointment.patientProfile.name || 
      appointment.patientProfile.patient?.auth?.name || 'Unknown';

    // Tự động xác định các đặc điểm ưu tiên
    const isElderly = patientAge > 70;
    const isPregnant = appointment.patientProfile.gender === 'FEMALE' && 
      (appointment.patientProfile.emergencyContact as any)?.pregnancyStatus === 'PREGNANT';
    
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

    // Thực hiện phân bổ
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
    
    // Tạo request assignment
    const assignmentRequest: AssignCounterDto = {
      appointmentId: `direct-${Date.now()}`, // Tạo ID tạm thời
      patientProfileId: `direct-${Date.now()}`, // Tạo ID tạm thời
      invoiceId: `direct-${Date.now()}`, // Tạo ID tạm thời
      patientName: request.patientName,
      patientAge: request.patientAge,
      patientGender: request.patientGender,
      isElderly,
      isPregnant,
      isEmergency: request.isEmergency || false,
      isDisabled: request.isDisabled || false,
      isVIP: request.isVIP || false,
      priorityLevel: request.priorityLevel || (isElderly || isPregnant ? 'HIGH' : 'MEDIUM'),
      notes: `Direct assignment by: ${request.assignedBy || 'Unknown'}`,
    };

    // Thực hiện phân bổ
    const assignment = await this.assignPatientToCounter(assignmentRequest);

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
    
    // Tạo thông tin bệnh nhân mặc định
    const assignmentRequest: AssignCounterDto = {
      appointmentId: `simple-${Date.now()}`,
      patientProfileId: `simple-${Date.now()}`,
      invoiceId: `simple-${Date.now()}`,
      patientName: `Bệnh nhân ${queueNumber}`,
      patientAge: 30, // Tuổi mặc định
      patientGender: 'MALE', // Giới tính mặc định
      isElderly: false,
      isPregnant: false,
      isEmergency: false,
      isDisabled: false,
      isVIP: false,
      priorityLevel: 'LOW', // Ưu tiên thấp nhất cho bốc số đơn thuần
      notes: `Simple assignment - Queue number: ${queueNumber} by: ${request.assignedBy || 'Unknown'}`,
    };

    // Thực hiện phân bổ
    const assignment = await this.assignPatientToCounter(assignmentRequest);

    return {
      success: true,
      assignment,
      queueNumber,
    };
  }
}
