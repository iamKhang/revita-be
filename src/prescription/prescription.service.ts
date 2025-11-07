/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionStatus } from '@prisma/client';
import { CodeGeneratorService } from '../user-management/patient-profile/code-generator.service';
import { JwtUserPayload } from '../medical-record/dto/jwt-user-payload.dto';
import { QueueResponseDto, QueuePatientDto } from './dto/queue-item.dto';
import { StartServicesDto, StartServicesResponseDto, ServiceToStartDto } from './dto/start-services.dto';
import { PendingServicesResponseDto, PendingServiceDto } from './dto/pending-services.dto';
import { RedisService } from '../cache/redis.service';
import { WebSocketService } from '../websocket/websocket.service';

@Injectable()
export class PrescriptionService {
  private codeGenerator = new CodeGeneratorService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly webSocketService: WebSocketService,
  ) {}

  async create(dto: CreatePrescriptionDto, user: JwtUserPayload) {
    const {
      prescriptionCode,
      patientProfileId,
      doctorId: dtoDoctorId,
      note,
      services,
      medicalRecordId,
    } = dto as any;

    // Extract doctorId from JWT token if not provided in DTO
    let doctorId = dtoDoctorId;
    if (!doctorId && user.doctor?.id) {
      doctorId = user.doctor.id;
    }

    // For RECEPTIONIST, doctorId is optional; for DOCTOR, doctorId is required (from token or DTO)
    if (user.role !== 'RECEPTIONIST' && !doctorId) {
      throw new BadRequestException(
        'Doctor ID is required (either from JWT token or DTO)',
      );
    }

    if (!services || services.length === 0) {
      throw new BadRequestException('services must not be empty');
    }

    // Validate patientProfileId exists
    const patientProfile = await this.prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      select: { id: true },
    });
    if (!patientProfile) {
      throw new NotFoundException('Patient profile not found');
    }

    // Validate doctorId exists if provided
    if (doctorId) {
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { id: true },
      });
      if (!doctor) {
        throw new NotFoundException('Doctor not found');
      }
    }

    // Accept serviceId or serviceCode; resolve to IDs
    // Validate each service provides at least one identifier (allow both)
    for (let i = 0; i < (services as any[]).length; i++) {
      const s = (services as any[])[i];
      if (!s.serviceId && !s.serviceCode) {
        throw new BadRequestException(
          'Each service must include serviceId or serviceCode',
        );
      }
    }

    const requestedById = (services as any[])
      .filter((s: any) => !!s.serviceId)
      .map((s: any) => s.serviceId);
    const requestedByCode = (services as any[])
      .filter((s: any) => !!s.serviceCode)
      .map((s: any) => s.serviceCode);
    const servicesById = await this.prisma.service.findMany({
      where: { id: { in: requestedById } },
      select: { id: true, requiresDoctor: true },
    });
    const servicesByCode = await this.prisma.service.findMany({
      where: { serviceCode: { in: requestedByCode } },
      select: { id: true, serviceCode: true, requiresDoctor: true },
    });
    const idSet = new Set(servicesById.map((s) => s.id));
    const codeToId = new Map(
      servicesByCode.map((s) => [s.serviceCode, s.id] as const),
    );
    const missingIds = requestedById.filter((id) => !idSet.has(id));
    const missingCodes = requestedByCode.filter((code) => !codeToId.has(code));
    if (missingIds.length || missingCodes.length) {
      const parts = [] as string[];
      if (missingIds.length)
        parts.push(`serviceId(s): ${missingIds.join(', ')}`);
      if (missingCodes.length)
        parts.push(`serviceCode(s): ${missingCodes.join(', ')}`);
      throw new BadRequestException(`Invalid ${parts.join(' and ')}`);
    }

    // Receptionist cannot assign services that require a doctor
    if (user.role === 'RECEPTIONIST') {
      const allResolved = [
        ...servicesById,
        ...servicesByCode.map((s) => ({ id: s.id, requiresDoctor: s.requiresDoctor })),
      ];
      const requiresDoctorIds = allResolved.filter((s) => s.requiresDoctor === true).map((s) => s.id);
      if (requiresDoctorIds.length > 0) {
        throw new BadRequestException(
          `Receptionist cannot assign services that require doctor: ${requiresDoctorIds.join(', ')}`,
        );
      }
    }

    // Optional: validate medicalRecord belongs to same patientProfile
    if (medicalRecordId) {
      const mr = await this.prisma.medicalRecord.findUnique({
        where: { id: medicalRecordId },
        select: { id: true, patientProfileId: true },
      });
      if (!mr) throw new NotFoundException('Medical record not found');
      if (mr.patientProfileId !== patientProfileId) {
        throw new BadRequestException(
          'medicalRecordId does not belong to the provided patientProfileId',
        );
      }
    }

    // Generate prescription code if not provided
    let finalPrescriptionCode = prescriptionCode;
    if (!finalPrescriptionCode) {
      // Get doctor and patient names for code generation
      const doctor = doctorId
        ? await this.prisma.doctor.findUnique({
            where: { id: doctorId },
            include: { auth: true },
          })
        : null;

      const patientProfile = await this.prisma.patientProfile.findUnique({
        where: { id: patientProfileId },
      });

      finalPrescriptionCode = this.codeGenerator.generatePrescriptionCode(
        doctor?.auth?.name || (user.role === 'RECEPTIONIST' ? 'Receptionist' : 'Unknown'),
        patientProfile?.name || 'Unknown',
      );
    }

    const prescription = await this.prisma.prescription.create({
      data: {
        prescriptionCode: finalPrescriptionCode,
        patientProfileId,
        doctorId: doctorId ?? null,
        medicalRecordId: medicalRecordId ?? null,
        note: note ?? null,
        services: {
          create: services.map((s, index) => ({
            serviceId: s.serviceId ?? codeToId.get(s.serviceCode as string)!,
            status: s.status || PrescriptionStatus.NOT_STARTED,
            order: s.order ?? index + 1,
            note: s.note ?? null,
            doctorId: s.doctorId ?? null,
            technicianId: s.technicianId ?? null,
          })),
        },
        // no medications here; managed by medication-prescription module
      },
      include: {
        services: {
          include: { service: true },
          orderBy: { order: 'asc' },
        },
        patientProfile: true,
        doctor: true,
      },
    });

    // Cập nhật queue trong Redis sau khi tạo prescription
    if (doctorId) {
      await this.updateQueueInRedis(doctorId, 'DOCTOR');
    }

    // Gửi WebSocket notification cho bệnh nhân mới đến
    await this.notifyNewPatientArrival(prescription);

    return prescription;
  }

  async findByCode(code: string) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { prescriptionCode: code },
      include: {
        services: { include: { service: true }, orderBy: { order: 'asc' } },
        patientProfile: true,
        doctor: true,
      },
      orderBy: { id: 'desc' },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }
    return prescription;
  }

  async findByCodeForUser(code: string, user: JwtUserPayload) {
    const prescription = await this.findByCode(code);
    // Patients can only access their own profile's prescriptions
    if (user.role === 'PATIENT') {
      const patient = (await this.prisma.patient.findUnique({
        where: { id: user.patient?.id as string },
        select: { id: true, patientProfiles: { select: { id: true } } },
      })) as any;
      const profileIds = new Set(
        (patient?.patientProfiles || []).map((p: any) => p.id),
      );
      if (!profileIds.has(prescription.patientProfileId)) {
        throw new NotFoundException('Prescription not found');
      }
    }
    return prescription;
  }

  async update(id: string, dto: UpdatePrescriptionDto, user: JwtUserPayload) {
    const existing = await this.prisma.prescription.findUnique({
      where: { id },
      include: { services: true },
    });
    if (!existing) throw new NotFoundException('Prescription not found');

    // Check if user is the doctor who created this prescription
    if (existing.doctorId !== user.doctor?.id) {
      throw new BadRequestException(
        'You can only update prescriptions you created',
      );
    }

    // Basic fields
    const data: any = {
      doctorId: dto.doctorId ?? existing.doctorId,
      note: dto.note ?? existing.note,
    };

    // If services provided, validate and then replace the list using provided objects
    if (dto.services && dto.services.length > 0) {
      const requestedById = dto.services

        .filter((s: any) => !!s.serviceId)
        .map((s: any) => s.serviceId);
      const requestedByCode = dto.services
        .filter((s: any) => !!s.serviceCode)
        .map((s: any) => s.serviceCode);
      if (
        requestedById.length + requestedByCode.length !==
        dto.services.length
      ) {
        throw new BadRequestException(
          'Each service must include serviceId or serviceCode',
        );
      }
      const servicesById = await this.prisma.service.findMany({
        where: { id: { in: requestedById } },
        select: { id: true },
      });
      const servicesByCode = await this.prisma.service.findMany({
        where: { serviceCode: { in: requestedByCode } },
        select: { id: true, serviceCode: true },
      });
      const idSet = new Set(servicesById.map((s) => s.id));
      const codeToId = new Map(
        servicesByCode.map((s) => [s.serviceCode, s.id] as const),
      );
      const missingIds = requestedById.filter((sid) => !idSet.has(sid));
      const missingCodes = requestedByCode.filter(
        (code) => !codeToId.has(code),
      );
      if (missingIds.length || missingCodes.length) {
        const parts = [] as string[];
        if (missingIds.length)
          parts.push(`serviceId(s): ${missingIds.join(', ')}`);
        if (missingCodes.length)
          parts.push(`serviceCode(s): ${missingCodes.join(', ')}`);
        throw new BadRequestException(`Invalid ${parts.join(' and ')}`);
      }
      await this.prisma.prescriptionService.deleteMany({
        where: { prescriptionId: id },
      });
      await this.prisma.prescription.update({
        where: { id },
        data: {
          ...data,
          services: {
            create: dto.services.map((s, index) => ({
              serviceId: s.serviceId ?? codeToId.get(s.serviceCode as string)!,
              status: (s.status as any) || PrescriptionStatus.NOT_STARTED,
              order: s.order ?? index + 1,
              note: s.note ?? null,
              doctorId: s.doctorId ?? null,
              technicianId: s.technicianId ?? null,
            })),
          },
        },
      });
    } else {
      await this.prisma.prescription.update({ where: { id }, data });
    }

    const result = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        services: { include: { service: true }, orderBy: { order: 'asc' } },
        patientProfile: true,
        doctor: true,
      },
    });

    // Cập nhật queue trong Redis sau khi cập nhật prescription
    if (result?.doctorId) {
      await this.updateQueueInRedis(result.doctorId, 'DOCTOR');
    }

    return result;
  }

  async cancel(id: string, user: JwtUserPayload) {
    const existing = await this.prisma.prescription.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Prescription not found');

    // Check if user is the doctor who created this prescription
    if (existing.doctorId !== user.doctor?.id) {
      throw new BadRequestException(
        'You can only cancel prescriptions you created',
      );
    }

    // Mark prescription and all services as CANCELLED
    await this.prisma.$transaction([
      this.prisma.prescription.update({
        where: { id },
        data: { status: PrescriptionStatus.CANCELLED },
      }),
      this.prisma.prescriptionService.updateMany({
        where: { prescriptionId: id },
        data: { status: PrescriptionStatus.CANCELLED },
      }),
    ]);

    // Cập nhật queue trong Redis sau khi hủy prescription
    if (existing?.doctorId) {
      await this.updateQueueInRedis(existing.doctorId, 'DOCTOR');
    }

    return { id, status: PrescriptionStatus.CANCELLED };
  }

  // Below are internal methods for status transitions. Expose later when integrating.

  async markServicePaid(prescriptionId: string, serviceId: string) {
    // This method is called by the system after payment success, so no user validation needed
    await this._markServicePaidInternal(prescriptionId, serviceId);
  }

  private async _markServicePaidInternal(
    prescriptionId: string,
    serviceId: string,
  ) {
    // Called after payment success for a given service
    // Mark the paid service as PENDING only (no auto-start)
    const psList = await this.prisma.prescriptionService.findMany({
      where: { prescriptionId },
      orderBy: { order: 'asc' },
    });
    if (psList.length === 0) throw new NotFoundException('No services found');

    const current = psList.find((s) => s.serviceId === serviceId);
    if (!current) throw new NotFoundException('Service not in prescription');

    // Nếu đã có bác sĩ/kỹ thuật viên được gán sẵn → chuyển WAITING, ngược lại → PENDING
    const nextStatus = current.doctorId || current.technicianId
      ? PrescriptionStatus.WAITING
      : PrescriptionStatus.PENDING;

    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { status: nextStatus },
    });

    // Auto-start disabled: do not move any service to WAITING here

    // Ensure prescription is at least PENDING
    await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: { status: PrescriptionStatus.PENDING },
    });
  }

  async markServiceServing(
    prescriptionId: string,
    serviceId: string,
    user: JwtUserPayload,
  ) {
    // Tech confirms to start service
    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { status: PrescriptionStatus.SERVING },
    });

    // Cập nhật queue trong Redis
    const prescriptionData = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { doctorId: true },
    });
    if (prescriptionData?.doctorId) {
      await this.updateQueueInRedis(prescriptionData.doctorId, 'DOCTOR');
    }
  }

  async markServiceWaitingResult(
    prescriptionId: string,
    serviceId: string,
    user: JwtUserPayload,
  ) {
    // Service done, waiting result, then unlock next pending service to WAITING
    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { status: PrescriptionStatus.WAITING_RESULT },
    });

    await this.unlockNextPendingService(prescriptionId);

    // Cập nhật queue trong Redis
    const prescriptionData = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { doctorId: true },
    });
    if (prescriptionData?.doctorId) {
      await this.updateQueueInRedis(prescriptionData.doctorId, 'DOCTOR');
    }
  }

  async markServiceCompleted(
    prescriptionId: string,
    serviceId: string,
    user: JwtUserPayload,
  ) {
    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { status: PrescriptionStatus.COMPLETED },
    });

    await this.unlockNextPendingService(prescriptionId);

    // If all services completed, complete prescription
    const remaining = await this.prisma.prescriptionService.count({
      where: { prescriptionId, NOT: { status: PrescriptionStatus.COMPLETED } },
    });
    if (remaining === 0) {
      await this.prisma.prescription.update({
        where: { id: prescriptionId },
        data: { status: PrescriptionStatus.COMPLETED },
      });
    }

    // Cập nhật queue trong Redis
    const prescriptionData = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { doctorId: true },
    });
    if (prescriptionData?.doctorId) {
      await this.updateQueueInRedis(prescriptionData.doctorId, 'DOCTOR');
    }
  }

  async markServiceSkipped(
    prescriptionId: string,
    serviceId: string,
    user: JwtUserPayload,
  ) {
    // Lấy thông tin service hiện tại để tăng skipCount
    const currentService = await this.prisma.prescriptionService.findUnique({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      select: { skipCount: true },
    });

    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { 
        status: PrescriptionStatus.SKIPPED,
        skipCount: (currentService?.skipCount || 0) + 1,
      },
    });

    // Cập nhật queue trong Redis
    const prescriptionData = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { doctorId: true },
    });
    if (prescriptionData?.doctorId) {
      await this.updateQueueInRedis(prescriptionData.doctorId, 'DOCTOR');
    }
  }

  async updateServiceStatus(
    prescriptionId: string,
    serviceId: string,
    status: PrescriptionStatus,
    user: JwtUserPayload,
  ) {
    // Kiểm tra service có tồn tại không
    const service = await this.prisma.prescriptionService.findUnique({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      select: { prescriptionId: true },
    });

    if (!service) {
      throw new NotFoundException('Prescription service not found');
    }

    // Update status
    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { status },
    });

    // Cập nhật queue trong Redis
    const prescriptionData = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { doctorId: true },
    });
    
    // Lấy technicianId từ PrescriptionService
    const prescriptionServiceData = await this.prisma.prescriptionService.findUnique({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      select: { technicianId: true },
    });
    
    if (prescriptionData?.doctorId) {
      await this.updateQueueInRedis(prescriptionData.doctorId, 'DOCTOR');
    }
    if (prescriptionServiceData?.technicianId) {
      await this.updateQueueInRedis(prescriptionServiceData.technicianId, 'TECHNICIAN');
    }

    return {
      prescriptionId,
      serviceId,
      status,
      message: 'Service status updated successfully',
    };
  }

  async getPrescriptionsByMedicalRecord(medicalRecordId: string) {
    const prescriptions = await this.prisma.prescription.findMany({
      where: { medicalRecordId },
      include: {
        services: {
          include: { service: true },
          orderBy: { order: 'asc' },
        },
        patientProfile: true,
        doctor: true,
      },
      orderBy: { id: 'desc' }, // Sắp xếp theo ID (UUID mới nhất trước)
    });

    return prescriptions;
  }

  async getPrescriptionsByMedicalRecordForUser(
    medicalRecordId: string,
    user: JwtUserPayload,
  ) {
    const list = await this.getPrescriptionsByMedicalRecord(medicalRecordId);
    if (user.role === 'PATIENT') {
      // Ensure the medical record belongs to this patient's profile(s)
      const mr = await this.prisma.medicalRecord.findUnique({
        where: { id: medicalRecordId },
        select: { patientProfileId: true },
      });
      if (!mr) throw new NotFoundException('Medical record not found');
      const patient = (await this.prisma.patient.findUnique({
        where: { id: user.patient?.id as string },
        select: { id: true, patientProfiles: { select: { id: true } } },
      })) as any;
      const profileIds = new Set(
        (patient?.patientProfiles || []).map((p: any) => p.id),
      );
      if (!profileIds.has(mr.patientProfileId)) {
        throw new NotFoundException('Medical record not found');
      }
      return list;
    }
    return list;
  }

  async getMyPrescriptionsByProfile(
    patientProfileId: string,
    user: JwtUserPayload,
  ) {
    // Check the profile belongs to current patient
    const patient = (await this.prisma.patient.findUnique({
      where: { id: user.patient?.id as string },
      select: { id: true, patientProfiles: { select: { id: true } } },
    })) as any;
    const profileIds = new Set(
      (patient?.patientProfiles || []).map((p: any) => p.id),
    );
    if (!profileIds.has(patientProfileId)) {
      throw new NotFoundException('Patient profile not found');
    }
    return this.prisma.prescription.findMany({
      where: { patientProfileId },
      include: {
        services: { include: { service: true }, orderBy: { order: 'asc' } },
        patientProfile: true,
        doctor: true,
      },
      orderBy: { id: 'desc' },
    });
  }

  // // OpenFDA integration (public drug info)
  // async searchDrugsOpenFda(query: string) {
  //   const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(query)}&limit=10`;
  //   const res = await axios.get(url);
  //   return res.data;
  // }

  // async getDrugByNdcOpenFda(ndc: string) {
  //   const url = `https://api.fda.gov/drug/ndc.json?search=product_ndc:${encodeURIComponent(ndc)}&limit=1`;
  //   const res = await axios.get(url);
  //   return res.data;
  // }

  private async _startFirstPendingServiceIfNoActive(prescriptionId: string) {
    const psList = await this.prisma.prescriptionService.findMany({
      where: { prescriptionId },
      orderBy: { order: 'asc' },
    });

    // Check if any service is currently active (WAITING, SERVING, WAITING_RESULT)
    const activeStatuses = [
      PrescriptionStatus.WAITING,
      PrescriptionStatus.SERVING,
      PrescriptionStatus.WAITING_RESULT,
    ];
    const activeExists = psList.some((s) =>
      activeStatuses.includes(s.status as any),
    );

    // If no active service, start the first PENDING service in order
    if (!activeExists) {
      // Find the service with lowest order that is PENDING (paid)
      const firstPendingService = psList
        .filter((s) => s.status === PrescriptionStatus.PENDING)
        .sort((a, b) => a.order - b.order)[0];

      if (firstPendingService) {
        // Auto routing removed: only move the first PENDING service to WAITING without assignment
        await this.prisma.prescriptionService.update({
          where: {
            prescriptionId_serviceId: {
              prescriptionId,
              serviceId: firstPendingService.serviceId,
            },
          },
          data: {
            status: PrescriptionStatus.WAITING,
            doctorId: null,
            technicianId: null,
          },
        });
      }
    }
  }

  private async unlockNextPendingService(prescriptionId: string) {
    await this._startFirstPendingServiceIfNoActive(prescriptionId);
  }

  /**
   * Assign the next pending service (lowest order) to an in-progress work session that can handle
   * the most pending services of this prescription, then break ties by least current workload.
   */
  async assignNextPendingService(prescriptionCode: string) {
    const now = new Date();
    const prescription = await this.prisma.prescription.findFirst({
      where: { prescriptionCode },
      include: {
        services: {
          include: { service: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    const pendingServices = prescription.services.filter((s) => s.status === PrescriptionStatus.PENDING);
    if (pendingServices.length === 0) {
      throw new BadRequestException('No pending services to assign');
    }

    const target = pendingServices[0];

    // Fetch IN_PROGRESS work sessions active now, with declared services
    const sessions = await this.prisma.workSession.findMany({
      where: {
        status: 'IN_PROGRESS' as any,
        startTime: { lte: now },
        endTime: { gte: now },
        services: {
          some: {},
        },
      },
      include: {
        services: true,
      },
    });

    if (sessions.length === 0) {
      throw new BadRequestException('No active work sessions');
    }

    const pendingServiceIds = new Set(pendingServices.map((ps) => ps.serviceId));
    const serviceIdToDuration = new Map(prescription.services.map((ps) => [ps.serviceId, ps.service?.durationMinutes ?? 15] as const));

    type ScoredSession = {
      session: any;
      canDoCount: number;
      timeLeftMin: number;
      currentWorkloadMin: number;
      canDoServiceIds: string[];
    };

    const scored: ScoredSession[] = [];
    for (const session of sessions) {
      const timeLeftMin = Math.max(0, Math.ceil((session.endTime.getTime() - now.getTime()) / 60000));
      const sessionServiceIds = new Set(session.services.map((ws: any) => ws.serviceId));
      // Candidate pending in this prescription that this session can do
      const canDo = pendingServices.filter((ps) => sessionServiceIds.has(ps.serviceId));
      if (canDo.length === 0) continue;

      // Filter sessions that at least can finish the first pending service
      const targetDuration = serviceIdToDuration.get(target.serviceId) ?? 15;
      if (timeLeftMin < targetDuration) continue;

      // Compute current workload in this session by summing durations of services started in this session window
      const startedHere = await this.prisma.prescriptionService.findMany({
        where: {
          workSessionId: session.id,
          startedAt: { gte: session.startTime, lte: session.endTime },
        },
        include: { service: true },
      });
      const currentWorkloadMin = startedHere.reduce((sum, x) => sum + (x.service?.durationMinutes ?? 15), 0);

      scored.push({
        session,
        canDoCount: canDo.length,
        timeLeftMin,
        currentWorkloadMin,
        canDoServiceIds: canDo.map((x) => x.serviceId),
      });
    }

    if (scored.length === 0) {
      throw new BadRequestException('No suitable work session found');
    }

    // Rank: most pending services it can do, then least workload, then most time left
    scored.sort((a, b) => {
      if (b.canDoCount !== a.canDoCount) return b.canDoCount - a.canDoCount;
      if (a.currentWorkloadMin !== b.currentWorkloadMin) return a.currentWorkloadMin - b.currentWorkloadMin;
      return b.timeLeftMin - a.timeLeftMin;
    });

    const chosen = scored[0].session;

    const updated = await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId: prescription.id, serviceId: target.serviceId } },
      data: {
        status: PrescriptionStatus.WAITING,
        doctorId: chosen.doctorId ?? null,
        technicianId: chosen.technicianId ?? null,
        workSessionId: chosen.id,
      },
      include: { service: true },
    });

    // Xây dựng preview queue cho user (doctor/technician) được gán
    let queuePreview: QueueResponseDto | null = null as any;
    try {
      const role = chosen.doctorId ? 'DOCTOR' : (chosen.technicianId ? 'TECHNICIAN' : null);
      const userId = chosen.doctorId ?? chosen.technicianId ?? null;
      if (role && userId) {
        queuePreview = await this.buildQueueFromDatabase({
          id: userId,
          role: role,
          doctor: role === 'DOCTOR' ? { id: userId } : undefined,
          technician: role === 'TECHNICIAN' ? { id: userId } : undefined,
        } as any);
      }
    } catch {}

    return {
      assignedService: {
        prescriptionId: updated.prescriptionId,
        serviceId: updated.serviceId,
        status: updated.status,
        doctorId: updated.doctorId,
        technicianId: updated.technicianId,
        workSessionId: updated.workSessionId,
      },
      chosenSession: {
        id: chosen.id,
        doctorId: chosen.doctorId,
        technicianId: chosen.technicianId,
        startTime: chosen.startTime,
        endTime: chosen.endTime,
      },
      queuePreview,
    };
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

  /**
   * Tính toán xem bệnh nhân có đến đúng giờ không dựa trên lịch hẹn
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
   * Tính toán độ ưu tiên cho dịch vụ dựa trên logic từ take-number.service.ts
   * Thứ tự ưu tiên: 1. Đang phục vụ 2. Tiếp theo 3. Bị skip (skipCount nhỏ nhất) 4. Miss (1) 5. Miss (2) 6. Miss (3) ... 7. Già (>75) 8. Trẻ em (<6) 9. Khuyết tật 10. Mang thai 11. Có lịch hẹn 12. Thường
   * 
   * QUAN TRỌNG: SERVING và PREPARING luôn ở vị trí đầu queue, không bị chen lên bởi bệnh nhân mới
   */
  private calculateServicePriority(
    status: PrescriptionStatus,
    patientAge: number,
    isDisabled: boolean,
    isPregnant: boolean,
    hasAppointment: boolean,
    order: number,
    startedAt: Date | null,
    skipCount: number = 0,
  ): number {
    let priorityScore = 0;

    // 1. Đang phục vụ (SERVING) - ưu tiên cao nhất, KHÔNG BAO GIỜ bị chen lên
    if (status === PrescriptionStatus.SERVING) {
      return 0;
    }
    
    // 2. Tiếp theo (PREPARING) - ưu tiên cao thứ 2, KHÔNG BAO GIỜ bị chen lên
    if (status === PrescriptionStatus.PREPARING) {
      return 100000;
    }
    
    // 3. Bị skip (SKIPPED) - ưu tiên cao thứ 3, skipCount nhỏ hơn thì ưu tiên hơn
    if (status === PrescriptionStatus.SKIPPED) {
      return 200000 + skipCount; // skipCount nhỏ hơn = ưu tiên cao hơn
    }
    
    // 4. Đang trả kết quả (RETURNING) - ưu tiên cao thứ 4
    if (status === PrescriptionStatus.RETURNING) {
      return 400000;
    }

    // 5. Chờ kết quả (WAITING_RESULT) - đứng cuối hàng chờ, càng về sau càng đứng cuối
    if (status === PrescriptionStatus.WAITING_RESULT) {
      // Sử dụng timestamp để đảm bảo càng về sau càng đứng cuối
      // Priority cao (999999999) để đảm bảo đứng cuối, cộng thêm timestamp để sắp xếp theo thời gian
      // completedAt được truyền qua startedAt parameter (hack để giữ signature)
      const timestamp = startedAt ? new Date(startedAt).getTime() : Date.now();
      return 999999999 + timestamp; // Càng về sau timestamp càng lớn = priority càng cao = đứng càng cuối
    }

    // 6. Người già (>75 tuổi) - ưu tiên cao thứ 6
    if (patientAge > 75) {
      priorityScore = 10000000 - patientAge; // Người già hơn ưu tiên hơn
    }
    // 7. Trẻ em (<6 tuổi) - ưu tiên cao thứ 7
    else if (patientAge < 6) {
      priorityScore = 20000000 - patientAge; // Trẻ em nhỏ hơn ưu tiên hơn
    }
    // 8. Người khuyết tật - ưu tiên cao thứ 8
    else if (isDisabled) {
      priorityScore = 30000000;
    }
    // 9. Người mang thai - ưu tiên cao thứ 9
    else if (isPregnant) {
      priorityScore = 40000000;
    }
    // 10. Người có lịch hẹn - ưu tiên cao thứ 10
    else if (hasAppointment) {
      priorityScore = 50000000;
    }
    // 11. Người thường - ưu tiên thấp nhất
    else {
      priorityScore = 60000000;
    }

    // Trong cùng nhóm ưu tiên, ai đến trước (order nhỏ hơn) thì ưu tiên hơn
    return priorityScore + order;
  }

  async getQueueForUser(user: JwtUserPayload): Promise<QueueResponseDto> {
    // Lấy queue từ Redis cho user cụ thể
    const userId = user.role === 'DOCTOR' ? user.doctor?.id : user.technician?.id;
    if (!userId) {
      return { patients: [], totalCount: 0 };
    }

    const queueKey = `prescriptionQueue:${user.role.toLowerCase()}:${userId}`;
    
    try {
      // Lấy queue từ Redis ZSET (đã được sắp xếp theo priority)
      const queueData = await this.redis.getPrescriptionQueue(userId, user.role as 'DOCTOR' | 'TECHNICIAN');
      
      if (!queueData || queueData.length === 0) {
        // Nếu không có queue trong Redis, tạo queue mới từ database
        return await this.buildQueueFromDatabase(user);
      }

      // Chuyển đổi dữ liệu từ Redis thành format response
      const patients = queueData.map((item, index) => ({
        patientProfileId: item.patientProfileId,
        patientName: item.patientName,
        prescriptionCode: item.prescriptionCode,
        services: item.services,
        overallStatus: item.overallStatus,
        queueOrder: index + 1,
      }));

      return {
        patients,
        totalCount: patients.length,
      };
    } catch (error) {
      console.warn('Error getting queue from Redis, falling back to database:', error);
      return await this.buildQueueFromDatabase(user);
    }
  }

  /**
   * Xây dựng queue từ database (fallback method)
   */
  private async buildQueueFromDatabase(user: JwtUserPayload): Promise<QueueResponseDto> {
    // Lấy tất cả PrescriptionService có trạng thái đang chờ
    const queueStatuses = [
      PrescriptionStatus.WAITING,
      PrescriptionStatus.PREPARING, 
      PrescriptionStatus.SERVING,
      PrescriptionStatus.SKIPPED,
      PrescriptionStatus.WAITING_RESULT,
      PrescriptionStatus.RETURNING,
    ];

    const prescriptionServices = await this.prisma.prescriptionService.findMany({
      where: {
        status: { in: queueStatuses },
        ...(user.role === 'DOCTOR' && user.doctor?.id
          ? { doctorId: user.doctor.id }
          : {}),
        ...(user.role === 'TECHNICIAN' && user.technician?.id
          ? { technicianId: user.technician.id }
          : {}),
      },
      include: {
        prescription: {
          include: {
            patientProfile: {
              select: {
                id: true,
                name: true,
                dateOfBirth: true,
                gender: true,
                isPregnant: true,
                isDisabled: true,
              },
            },
            medicalRecord: {
              select: {
                appointment: {
                  select: {
                    appointmentCode: true,
                    date: true,
                    startTime: true,
                    endTime: true,
                  },
                },
              },
            },
          },
        },
        service: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { order: 'asc' },
        { prescription: { id: 'asc' } },
      ],
    });

    // Gom nhóm theo bệnh nhân và tính toán độ ưu tiên
    const patientMap = new Map<string, any>();

    prescriptionServices.forEach((ps) => {
      const patientProfileId = ps.prescription.patientProfileId;
      const patientName = ps.prescription.patientProfile.name;
      const prescriptionCode = ps.prescription.prescriptionCode;
      const patientProfile = ps.prescription.patientProfile;
      const appointment = ps.prescription.medicalRecord?.appointment;

      if (!patientMap.has(patientProfileId)) {
        // Tính toán thông tin ưu tiên cho bệnh nhân
        const age = this.calculateAge(patientProfile.dateOfBirth);
        const isPregnant = patientProfile.isPregnant || false;
        const isDisabled = patientProfile.isDisabled || false;
        const hasAppointment = !!appointment;
        const isOnTime = this.calculateIsOnTime(hasAppointment, appointment);

        patientMap.set(patientProfileId, {
          patientProfileId,
          patientName,
          prescriptionCode,
          services: [],
          minOrder: ps.order,
          priorities: [],
          // Thông tin ưu tiên
          age,
          isPregnant,
          isDisabled,
          hasAppointment,
          isOnTime,
          earliestStartedAt: ps.startedAt,
          earliestCompletedAt: ps.status === PrescriptionStatus.WAITING_RESULT ? ps.completedAt : null,
          minSkipCount: ps.skipCount || 0,
        });
      }

      const patient = patientMap.get(patientProfileId);
      patient.services.push({
        prescriptionId: ps.prescriptionId,
        serviceId: ps.serviceId,
        serviceName: ps.service.name,
        order: ps.order,
        status: ps.status,
        note: ps.note,
        startedAt: ps.startedAt,
        completedAt: ps.completedAt,
        skipCount: ps.skipCount || 0,
      });

      // Cập nhật order nhỏ nhất
      if (ps.order < patient.minOrder) {
        patient.minOrder = ps.order;
      }

      // Cập nhật thời gian bắt đầu sớm nhất
      if (ps.startedAt && (!patient.earliestStartedAt || ps.startedAt < patient.earliestStartedAt)) {
        patient.earliestStartedAt = ps.startedAt;
      }

      // Cập nhật thời gian hoàn thành sớm nhất cho WAITING_RESULT
      if (ps.status === PrescriptionStatus.WAITING_RESULT && ps.completedAt) {
        if (!patient.earliestCompletedAt || ps.completedAt < patient.earliestCompletedAt) {
          patient.earliestCompletedAt = ps.completedAt;
        }
      }

      // Cập nhật skipCount nhỏ nhất
      if ((ps.skipCount || 0) < patient.minSkipCount) {
        patient.minSkipCount = ps.skipCount || 0;
      }

      // Tính toán độ ưu tiên cho từng dịch vụ
      // Với WAITING_RESULT, sử dụng completedAt thay vì startedAt để sắp xếp theo thời gian hoàn thành
      const timeForPriority = ps.status === PrescriptionStatus.WAITING_RESULT && ps.completedAt 
        ? ps.completedAt 
        : ps.startedAt;
      const servicePriority = this.calculateServicePriority(
        ps.status,
        patient.age,
        patient.isDisabled,
        patient.isPregnant,
        patient.hasAppointment,
        ps.order,
        timeForPriority,
        ps.skipCount || 0,
      );

      patient.priorities.push(servicePriority);
    });

    // Chuyển đổi thành array và sắp xếp theo độ ưu tiên
    const patients = Array.from(patientMap.values()).map((patient) => {
      // Lấy trạng thái có độ ưu tiên cao nhất
      const highestPriorityStatus = Math.min(...patient.priorities);
      
      // Xác định overallStatus dựa trên priority score
      let overallStatus: QueuePatientDto['overallStatus'] = 'WAITING';
      
      if (highestPriorityStatus === 0) {
        overallStatus = 'SERVING';
      } else if (highestPriorityStatus >= 100000 && highestPriorityStatus < 200000) {
        overallStatus = 'PREPARING';
      } else if (highestPriorityStatus >= 200000 && highestPriorityStatus < 300000) {
        overallStatus = 'SKIPPED';
      } else if (highestPriorityStatus >= 400000 && highestPriorityStatus < 500000) {
        overallStatus = 'RETURNING';
      } else if (highestPriorityStatus >= 999999999) {
        overallStatus = 'WAITING_RESULT';
      } else {
        overallStatus = 'WAITING';
      }

      return {
        patientProfileId: patient.patientProfileId,
        patientName: patient.patientName,
        prescriptionCode: patient.prescriptionCode,
        services: patient.services.sort((a, b) => a.order - b.order),
        overallStatus,
        queueOrder: 0, // Sẽ được cập nhật sau khi sắp xếp
        // Thông tin ưu tiên để sắp xếp
        priorityScore: Math.min(...patient.priorities),
          earliestStartedAt: patient.earliestStartedAt,
          earliestCompletedAt: patient.earliestCompletedAt,
          age: patient.age,
          isPregnant: patient.isPregnant,
          isDisabled: patient.isDisabled,
          hasAppointment: patient.hasAppointment,
          isOnTime: patient.isOnTime,
          skipCount: patient.minSkipCount,
        };
    });

    // Sắp xếp theo độ ưu tiên: SERVING và PREPARING luôn ở đầu, WAITING_RESULT luôn ở cuối
    patients.sort((a, b) => {
      // WAITING_RESULT luôn ở vị trí cuối cùng
      if (a.overallStatus === 'WAITING_RESULT' && b.overallStatus !== 'WAITING_RESULT') return 1;
      if (b.overallStatus === 'WAITING_RESULT' && a.overallStatus !== 'WAITING_RESULT') return -1;
      
      // Nếu cả hai đều là WAITING_RESULT, sắp xếp theo thời gian hoàn thành (càng về sau càng đứng cuối)
      if (a.overallStatus === 'WAITING_RESULT' && b.overallStatus === 'WAITING_RESULT') {
        const aTime = (a as any).earliestCompletedAt ? new Date((a as any).earliestCompletedAt).getTime() : 
                      (a.earliestStartedAt ? new Date(a.earliestStartedAt).getTime() : 0);
        const bTime = (b as any).earliestCompletedAt ? new Date((b as any).earliestCompletedAt).getTime() : 
                      (b.earliestStartedAt ? new Date(b.earliestStartedAt).getTime() : 0);
        return aTime - bTime; // Thời gian sớm hơn đứng trước (càng về sau càng đứng cuối)
      }
      
      // SERVING luôn ở vị trí đầu tiên
      if (a.overallStatus === 'SERVING' && b.overallStatus !== 'SERVING') return -1;
      if (b.overallStatus === 'SERVING' && a.overallStatus !== 'SERVING') return 1;
      
      // PREPARING luôn ở vị trí thứ 2 (sau SERVING)
      if (a.overallStatus === 'PREPARING' && b.overallStatus !== 'PREPARING' && b.overallStatus !== 'SERVING') return -1;
      if (b.overallStatus === 'PREPARING' && a.overallStatus !== 'PREPARING' && a.overallStatus !== 'SERVING') return 1;
      
      // Các trạng thái khác sắp xếp theo priorityScore
      if (a.priorityScore !== b.priorityScore) {
        return a.priorityScore - b.priorityScore;
      }
      
      // Nếu cùng priorityScore, sắp xếp theo startedAt (sớm hơn = ưu tiên cao hơn)
      if (a.earliestStartedAt && b.earliestStartedAt) {
        return new Date(a.earliestStartedAt).getTime() - new Date(b.earliestStartedAt).getTime();
      }
      
      // Nếu một trong hai không có startedAt, ưu tiên cái có startedAt
      if (a.earliestStartedAt && !b.earliestStartedAt) return -1;
      if (!a.earliestStartedAt && b.earliestStartedAt) return 1;
      
      // Nếu cả hai đều không có startedAt, sắp xếp theo patientProfileId
      return a.patientProfileId.localeCompare(b.patientProfileId);
    });

    // Cập nhật lại queueOrder sau khi sắp xếp
    patients.forEach((patient, index) => {
      patient.queueOrder = index + 1;
      // Xóa các trường tạm thời không cần thiết cho response
      if ('priorityScore' in patient) delete (patient as any).priorityScore;
      if ('earliestStartedAt' in patient) delete (patient as any).earliestStartedAt;
      if ('age' in patient) delete (patient as any).age;
      if ('isPregnant' in patient) delete (patient as any).isPregnant;
      if ('isDisabled' in patient) delete (patient as any).isDisabled;
      if ('hasAppointment' in patient) delete (patient as any).hasAppointment;
      if ('isOnTime' in patient) delete (patient as any).isOnTime;
      if ('skipCount' in patient) delete (patient as any).skipCount;
    });

    return {
      patients,
      totalCount: patients.length,
    };
  }

  /**
   * Cập nhật queue vào Redis cho user cụ thể
   */
  async updateQueueInRedis(userId: string, userRole: 'DOCTOR' | 'TECHNICIAN'): Promise<void> {
    try {
      // Lấy dữ liệu queue từ database
      const queueData = await this.buildQueueFromDatabase({
        id: userId,
        role: userRole as 'DOCTOR' | 'TECHNICIAN',
        doctor: userRole === 'DOCTOR' ? { id: userId } : undefined,
        technician: userRole === 'TECHNICIAN' ? { id: userId } : undefined,
      } as JwtUserPayload);

      // Chuyển đổi thành format cho Redis với priority được tính lại để đảm bảo SERVING/PREPARING ở đầu, WAITING_RESULT ở cuối
      const redisQueueData = queueData.patients.map((patient, index) => {
        // Tính lại priority để đảm bảo SERVING và PREPARING luôn ở đầu, WAITING_RESULT ở cuối
        let redisPriority = this.calculatePatientPriority(patient);
        
        // Đảm bảo SERVING và PREPARING có priority cao nhất
        if (patient.overallStatus === 'SERVING') {
          redisPriority = 0;
        } else if (patient.overallStatus === 'PREPARING') {
          redisPriority = 100000;
        } else if (patient.overallStatus === 'WAITING_RESULT') {
          // WAITING_RESULT: đảm bảo đứng cuối, càng về sau càng đứng cuối
          // Ưu tiên dùng completedAt nếu có, nếu không thì dùng startedAt
          const patientAny = patient as any;
          const completedAt = patientAny.earliestCompletedAt || patientAny.earliestStartedAt;
          const timestamp = completedAt ? new Date(completedAt).getTime() : Date.now();
          redisPriority = 999999999 + timestamp;
        }
        
        return {
          patientProfileId: patient.patientProfileId,
          patientName: patient.patientName,
          prescriptionCode: patient.prescriptionCode,
          services: patient.services,
          overallStatus: patient.overallStatus,
          queueOrder: index + 1,
          priorityScore: redisPriority,
          updatedAt: new Date().toISOString(),
        };
      });

      // Lưu vào Redis ZSET
      await this.redis.updatePrescriptionQueue(userId, userRole, redisQueueData);
    } catch (error) {
      console.warn('Error updating queue in Redis:', error);
    }
  }

  /**
   * Tính toán priority cho bệnh nhân để sắp xếp trong Redis
   */
  private calculatePatientPriority(patient: any): number {
    // Sử dụng logic tương tự như calculateServicePriority
    const status = patient.overallStatus;
    const age = patient.age || 0;
    const isDisabled = patient.isDisabled || false;
    const isPregnant = patient.isPregnant || false;
    const hasAppointment = patient.hasAppointment || false;
    const order = patient.queueOrder || 0;
    const skipCount = patient.skipCount || 0;

    return this.calculateServicePriority(
      status as PrescriptionStatus,
      age,
      isDisabled,
      isPregnant,
      hasAppointment,
      order,
      null,
      skipCount
    );
  }

  /**
   * Thêm bệnh nhân vào queue Redis
   */
  async addPatientToQueue(
    userId: string, 
    userRole: 'DOCTOR' | 'TECHNICIAN',
    patientData: any
  ): Promise<void> {
    try {
      await this.redis.addToPrescriptionQueue(userId, userRole, patientData);
    } catch (error) {
      console.warn('Error adding patient to queue:', error);
    }
  }

  /**
   * Xóa bệnh nhân khỏi queue Redis
   */
  async removePatientFromQueue(
    userId: string,
    userRole: 'DOCTOR' | 'TECHNICIAN', 
    patientProfileId: string
  ): Promise<void> {
    try {
      await this.redis.removeFromPrescriptionQueue(userId, userRole, patientProfileId);
    } catch (error) {
      console.warn('Error removing patient from queue:', error);
    }
  }

  /**
   * Cập nhật trạng thái bệnh nhân trong queue Redis
   */
  async updatePatientStatusInQueue(
    userId: string,
    userRole: 'DOCTOR' | 'TECHNICIAN',
    patientProfileId: string,
    newStatus: string
  ): Promise<void> {
    try {
      await this.redis.updatePrescriptionQueueStatus(userId, userRole, patientProfileId, newStatus);
    } catch (error) {
      console.warn('Error updating patient status in queue:', error);
    }
  }

  /**
   * Chuyển các PrescriptionService từ PENDING sang WAITING và thêm vào queue
   */
  async startServices(dto: StartServicesDto, user?: JwtUserPayload): Promise<StartServicesResponseDto> {
    const startedServices: any[] = [];
    const failedServices: any[] = [];
    const startedAt = new Date();

    // Xử lý từng service
    for (const serviceToStart of dto.services) {
      try {
        const result = await this.startSingleService(
          serviceToStart.prescriptionId,
          serviceToStart.serviceId,
          user,
          startedAt
        );

        if (result.success) {
          startedServices.push({
            prescriptionId: serviceToStart.prescriptionId,
            serviceId: serviceToStart.serviceId,
            status: 'WAITING',
            startedAt: startedAt.toISOString(),
          });
        } else {
          failedServices.push({
            prescriptionId: serviceToStart.prescriptionId,
            serviceId: serviceToStart.serviceId,
            reason: result.reason,
          });
        }
      } catch (error) {
        failedServices.push({
          prescriptionId: serviceToStart.prescriptionId,
          serviceId: serviceToStart.serviceId,
          reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return {
      success: true,
      startedServices,
      failedServices,
      totalStarted: startedServices.length,
      totalFailed: failedServices.length,
    };
  }

  /**
   * Chuyển một PrescriptionService từ PENDING sang WAITING
   */
  private async startSingleService(
    prescriptionId: string,
    serviceId: string,
    user: JwtUserPayload | undefined,
    startedAt: Date
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      // Tìm PrescriptionService
      const prescriptionService = await this.prisma.prescriptionService.findUnique({
        where: {
          prescriptionId_serviceId: {
            prescriptionId,
            serviceId,
          },
        },
        include: {
          prescription: {
            select: {
              doctorId: true,
              patientProfileId: true,
            },
          },
        },
      });

      if (!prescriptionService) {
        return {
          success: false,
          reason: 'PrescriptionService not found',
        };
      }

      // Kiểm tra quyền truy cập
      if (user?.role === 'DOCTOR' && prescriptionService.prescription.doctorId !== user.doctor?.id) {
        return {
          success: false,
          reason: 'You can only start services in prescriptions you created',
        };
      }

      if (user?.role === 'TECHNICIAN' && prescriptionService.technicianId !== user.technician?.id) {
        return {
          success: false,
          reason: 'You can only start services assigned to you',
        };
      }

      // Kiểm tra trạng thái hiện tại
      if (prescriptionService.status !== PrescriptionStatus.PENDING) {
        return {
          success: false,
          reason: `Service is not in PENDING status. Current status: ${prescriptionService.status}`,
        };
      }

      // Cập nhật trạng thái sang WAITING
      await this.prisma.prescriptionService.update({
        where: {
          prescriptionId_serviceId: {
            prescriptionId,
            serviceId,
          },
        },
        data: {
          status: PrescriptionStatus.WAITING,
          startedAt,
        },
      });

      // Cập nhật queue trong Redis cho doctor
      if (prescriptionService.prescription.doctorId) {
        await this.updateQueueInRedis(prescriptionService.prescription.doctorId, 'DOCTOR');
      }

      // Cập nhật queue trong Redis cho technician nếu có
      if (prescriptionService.technicianId) {
        await this.updateQueueInRedis(prescriptionService.technicianId, 'TECHNICIAN');
      }

      return { success: true };
    } catch (error) {
      console.error('Error starting service:', error);
      return {
        success: false,
        reason: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Lấy các dịch vụ PENDING liên tiếp có cùng bác sĩ/kỹ thuật viên thực hiện
   */
  async getPendingServicesByPrescriptionCode(prescriptionCode: string): Promise<PendingServicesResponseDto> {
    try {
      // Tìm prescription theo mã
      const prescription = await this.prisma.prescription.findFirst({
        where: { prescriptionCode },
        include: {
          services: {
            where: { status: PrescriptionStatus.PENDING },
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!prescription) {
        throw new NotFoundException('Prescription not found');
      }

      if (prescription.services.length === 0) {
        return {
          prescriptionId: prescription.id,
          prescriptionCode,
          services: [],
          status: 'PENDING',
          totalCount: 0,
        };
      }

      // Tìm nhóm dịch vụ PENDING liên tiếp có cùng bác sĩ/kỹ thuật viên
      const consecutivePendingServices = this.findConsecutivePendingServices(prescription.services);

      const services: PendingServiceDto[] = consecutivePendingServices.map(ps => ({
        serviceId: ps.serviceId,
        serviceName: ps.service.name,
      }));

      return {
        prescriptionId: prescription.id,
        prescriptionCode,
        services,
        status: 'PENDING',
        totalCount: services.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error getting pending services:', error);
      throw new BadRequestException('Failed to get pending services');
    }
  }

  /**
   * Tìm các dịch vụ PENDING liên tiếp có cùng bác sĩ/kỹ thuật viên
   */
  private findConsecutivePendingServices(services: any[]): any[] {
    if (services.length === 0) return [];

    const result: any[] = [];
    let currentGroup: any[] = [];
    let currentDoctorId: string | null = null;
    let currentTechnicianId: string | null = null;

    for (const service of services) {
      const serviceDoctorId = service.doctorId;
      const serviceTechnicianId = service.technicianId;

      // Kiểm tra xem có cùng bác sĩ/kỹ thuật viên với nhóm hiện tại không
      const isSameAssignee = 
        (serviceDoctorId && serviceDoctorId === currentDoctorId) ||
        (serviceTechnicianId && serviceTechnicianId === currentTechnicianId) ||
        (!serviceDoctorId && !serviceTechnicianId && !currentDoctorId && !currentTechnicianId);

      if (isSameAssignee) {
        // Thêm vào nhóm hiện tại
        currentGroup.push(service);
        currentDoctorId = serviceDoctorId;
        currentTechnicianId = serviceTechnicianId;
      } else {
        // Nếu nhóm hiện tại có ít nhất 1 dịch vụ, lưu lại
        if (currentGroup.length > 0) {
          result.push(...currentGroup);
        }
        
        // Bắt đầu nhóm mới
        currentGroup = [service];
        currentDoctorId = serviceDoctorId;
        currentTechnicianId = serviceTechnicianId;
      }
    }

    // Thêm nhóm cuối cùng nếu có
    if (currentGroup.length > 0) {
      result.push(...currentGroup);
    }

    return result;
  }

  /**
   * Gọi bệnh nhân tiếp theo trong queue
   * Logic: 
   * 1. Lấy bệnh nhân đầu queue
   * 2. Nếu không phải SERVING → cập nhật thành SERVING
   * 3. Cập nhật bệnh nhân đang SERVING thành COMPLETED và xóa khỏi queue
   * 4. Cập nhật bệnh nhân tiếp theo thành PREPARING
   */
  async callNextPatient(user: JwtUserPayload): Promise<{
    success: boolean;
    currentPatient?: any;
    nextPatient?: any;
    preparingPatient?: any;
    message: string;
  }> {
    try {
      const userId = user.role === 'DOCTOR' ? user.doctor?.id : user.technician?.id;
      if (!userId) {
        throw new BadRequestException('User ID not found');
      }

      // Lấy queue hiện tại từ database để đảm bảo dữ liệu chính xác
      const queueData = await this.buildQueueFromDatabase(user);
      
      if (queueData.patients.length === 0) {
        return {
          success: false,
          message: 'Không có bệnh nhân nào trong hàng chờ',
        };
      }

      // Lấy bệnh nhân đầu queue (ưu tiên cao nhất)
      const nextPatient = queueData.patients[0];
      
      // Tìm bệnh nhân đang SERVING hiện tại
      const currentServingPatient = queueData.patients.find(p => p.overallStatus === 'SERVING');
      
      // Tìm bệnh nhân tiếp theo để chuẩn bị (PREPARING)
      // Logic: 
      // - Nếu có bệnh nhân SERVING hiện tại: bệnh nhân tiếp theo sau SERVING sẽ là PREPARING
      // - Nếu không có bệnh nhân SERVING: bệnh nhân đầu queue sẽ thành SERVING, bệnh nhân thứ 2 sẽ thành PREPARING
      let preparingPatient: any = null;
      
      if (currentServingPatient) {
        // Nếu có bệnh nhân SERVING, tìm bệnh nhân tiếp theo sau SERVING
        const servingIndex = queueData.patients.findIndex(p => p.overallStatus === 'SERVING');
        preparingPatient = queueData.patients[servingIndex + 1] || null;
      } else {
        // Nếu không có bệnh nhân SERVING, bệnh nhân thứ 2 sẽ là PREPARING
        preparingPatient = queueData.patients.length > 1 ? queueData.patients[1] : null;
      }

      // Thực hiện các cập nhật trong transaction
      await this.prisma.$transaction(async (tx) => {
        // 1. Cập nhật bệnh nhân đang SERVING thành COMPLETED (nếu có)
        if (currentServingPatient) {
          for (const service of currentServingPatient.services) {
            if (service.status === 'SERVING') {
              await tx.prescriptionService.update({
                where: {
                  prescriptionId_serviceId: {
                    prescriptionId: service.prescriptionId,
                    serviceId: service.serviceId,
                  },
                },
                data: {
                  status: PrescriptionStatus.COMPLETED,
                  completedAt: new Date(),
                },
              });
            }
          }
        }

        // 2. Cập nhật bệnh nhân tiếp theo thành SERVING
        // Nếu không có bệnh nhân SERVING hiện tại, thì bệnh nhân đầu queue sẽ thành SERVING
        // Nếu có bệnh nhân SERVING hiện tại, thì bệnh nhân đầu queue sẽ thành SERVING (thay thế)
        for (const service of nextPatient.services) {
          if (service.status === 'WAITING' || service.status === 'SKIPPED' || service.status === 'PREPARING') {
            await tx.prescriptionService.update({
              where: {
                prescriptionId_serviceId: {
                  prescriptionId: service.prescriptionId,
                  serviceId: service.serviceId,
                },
              },
              data: {
                status: PrescriptionStatus.SERVING,
                startedAt: new Date(),
              },
            });
          }
        }

        // 3. Cập nhật bệnh nhân tiếp theo thành PREPARING (nếu có)
        if (preparingPatient && preparingPatient.patientProfileId !== nextPatient.patientProfileId) {
          for (const service of preparingPatient.services) {
            if (service.status === 'WAITING' || service.status === 'SKIPPED') {
              await tx.prescriptionService.update({
                where: {
                  prescriptionId_serviceId: {
                    prescriptionId: service.prescriptionId,
                    serviceId: service.serviceId,
                  },
                },
                data: {
                  status: PrescriptionStatus.PREPARING,
                },
              });
            }
          }
        }
      });

      // Cập nhật queue trong Redis
      await this.updateQueueInRedis(userId, user.role as 'DOCTOR' | 'TECHNICIAN');

      // Gửi WebSocket notification cho hành động gọi bệnh nhân
      await this.notifyPatientAction({
        action: 'CALLED',
        currentPatient: currentServingPatient,
        nextPatient,
        preparingPatient,
        doctorId: user.role === 'DOCTOR' ? userId : undefined,
        technicianId: user.role === 'TECHNICIAN' ? userId : undefined,
      });

      return {
        success: true,
        currentPatient: currentServingPatient ? {
          patientProfileId: currentServingPatient.patientProfileId,
          patientName: currentServingPatient.patientName,
          prescriptionCode: currentServingPatient.prescriptionCode,
          status: 'COMPLETED',
        } : null,
        nextPatient: {
          patientProfileId: nextPatient.patientProfileId,
          patientName: nextPatient.patientName,
          prescriptionCode: nextPatient.prescriptionCode,
          status: 'SERVING',
        },
        preparingPatient: preparingPatient ? {
          patientProfileId: preparingPatient.patientProfileId,
          patientName: preparingPatient.patientName,
          prescriptionCode: preparingPatient.prescriptionCode,
          status: 'PREPARING',
        } : null,
        message: `Đã gọi bệnh nhân: ${nextPatient.patientName}`,
      };

    } catch (error) {
      console.error('Error calling next patient:', error);
      return {
        success: false,
        message: `Lỗi khi gọi bệnh nhân: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==================== WEBSOCKET NOTIFICATION METHODS ====================

  /**
   * Thông báo bệnh nhân mới đến
   */
  private async notifyNewPatientArrival(prescription: any): Promise<void> {
    try {
      // Lấy thông tin về các phòng và buồng liên quan
      const serviceIds = prescription.services.map((s: any) => s.serviceId);
      const { clinicRoomIds, boothIds } = await this.getRelatedRoomsAndBooths(serviceIds);

      await this.webSocketService.notifyNewPrescriptionPatient({
        patientProfileId: prescription.patientProfileId,
        patientName: prescription.patientProfile.name,
        prescriptionCode: prescription.prescriptionCode,
        services: prescription.services,
        doctorId: prescription.doctorId,
        technicianId: prescription.services[0]?.technicianId,
        serviceIds,
        clinicRoomIds,
        boothIds,
      });
    } catch (error) {
      console.error('Error notifying new patient arrival:', error);
    }
  }

  /**
   * Thông báo hành động của bác sĩ/kỹ thuật viên
   */
  private async notifyPatientAction(actionData: {
    action: 'CALLED' | 'SKIPPED';
    prescriptionId?: string;
    serviceId?: string;
    currentPatient?: any;
    nextPatient?: any;
    preparingPatient?: any;
    doctorId?: string;
    technicianId?: string;
  }): Promise<void> {
    try {
      let serviceIds: string[] = [];
      let clinicRoomIds: string[] = [];
      let boothIds: string[] = [];
      let patientData: any = null;

      if (actionData.prescriptionId && actionData.serviceId) {
        // Trường hợp skip service cụ thể
        const prescription = await this.prisma.prescription.findUnique({
          where: { id: actionData.prescriptionId },
          include: {
            services: { include: { service: true } },
            patientProfile: true,
          },
        });

        if (prescription) {
          serviceIds = prescription.services.map((s: any) => s.serviceId);
          const roomsData = await this.getRelatedRoomsAndBooths(serviceIds);
          clinicRoomIds = roomsData.clinicRoomIds;
          boothIds = roomsData.boothIds;

          patientData = {
            patientProfileId: prescription.patientProfileId,
            patientName: prescription.patientProfile.name,
            prescriptionCode: prescription.prescriptionCode,
          };
        }
      } else if (actionData.nextPatient) {
        // Trường hợp gọi bệnh nhân tiếp theo
        patientData = {
          patientProfileId: actionData.nextPatient.patientProfileId,
          patientName: actionData.nextPatient.patientName,
          prescriptionCode: actionData.nextPatient.prescriptionCode,
        };

        // Lấy serviceIds từ nextPatient
        serviceIds = actionData.nextPatient.services?.map((s: any) => s.serviceId) || [];
        const roomsData = await this.getRelatedRoomsAndBooths(serviceIds);
        clinicRoomIds = roomsData.clinicRoomIds;
        boothIds = roomsData.boothIds;
      }

      if (patientData) {
        await this.webSocketService.notifyPatientCalled({
          ...patientData,
          doctorId: actionData.doctorId,
          technicianId: actionData.technicianId,
          serviceIds,
          clinicRoomIds,
          boothIds,
          action: actionData.action,
          currentPatient: actionData.currentPatient,
          nextPatient: actionData.nextPatient,
          preparingPatient: actionData.preparingPatient,
        });
      }
    } catch (error) {
      console.error('Error notifying patient action:', error);
    }
  }

  /**
   * Lấy thông tin về các phòng và buồng liên quan đến services
   */
  private async getRelatedRoomsAndBooths(serviceIds: string[]): Promise<{
    clinicRoomIds: string[];
    boothIds: string[];
  }> {
    try {
      const services = await this.prisma.service.findMany({
        where: { id: { in: serviceIds } },
        include: {
          clinicRoomServices: {
            include: {
              clinicRoom: {
                include: {
                  booth: {
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      });

      const clinicRoomIds: string[] = [];
      const boothIds: string[] = [];

      services.forEach(service => {
        service.clinicRoomServices.forEach(crs => {
          clinicRoomIds.push(crs.clinicRoom.id);
          crs.clinicRoom.booth.forEach(booth => {
            boothIds.push(booth.id);
          });
        });
      });

      return {
        clinicRoomIds: [...new Set(clinicRoomIds)], // Remove duplicates
        boothIds: [...new Set(boothIds)], // Remove duplicates
      };
    } catch (error) {
      console.error('Error getting related rooms and booths:', error);
      return { clinicRoomIds: [], boothIds: [] };
    }
  }

  async createPrescriptionFromAppointment(
    appointmentCode: string,
    user: JwtUserPayload,
  ) {
    const appt = await this.prisma.appointment.findFirst({
      where: { appointmentCode },
      include: {
        patientProfile: true,
        doctor: { include: { auth: true } },
        appointmentServices: true,
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (!appt.patientProfile) throw new NotFoundException('Patient profile not found');

    const doctorId = appt.doctorId ?? user.doctor?.id ?? null;
    const servicesToCreate = (appt.appointmentServices || []).map((as, idx) => ({
      serviceId: as.serviceId,
      status: PrescriptionStatus.NOT_STARTED,
      order: idx + 1,
      note: null,
      doctorId: doctorId,
      technicianId: null,
    }));
    if (servicesToCreate.length === 0) {
      throw new BadRequestException('Appointment has no services');
    }

    const doctorName = appt.doctor?.auth?.name || (user.role === 'RECEPTIONIST' ? 'Receptionist' : 'Unknown');
    const code = this.codeGenerator.generatePrescriptionCode(
      doctorName,
      appt.patientProfile.name,
    );

    const prescription = await this.prisma.prescription.create({
      data: {
        prescriptionCode: code,
        patientProfileId: appt.patientProfileId,
        doctorId: doctorId,
        note: null,
        medicalRecordId: null,
        services: { create: servicesToCreate },
      },
      include: {
        services: { include: { service: true }, orderBy: { order: 'asc' } },
        patientProfile: true,
        doctor: true,
      },
    });

    return prescription;
  }


  async getAppointmentByCode(appointmentCode: string) {
    const appt = await this.prisma.appointment.findFirst({
      where: { appointmentCode },
      include: {
        patientProfile: true,
        specialty: true,
        doctor: { include: { auth: true } },
        service: true,
        workSession: true,
        appointmentServices: {
          include: { service: true },
        },
      },
    });
    if (!appt) {
      throw new NotFoundException('Appointment not found');
    }
    return appt;
  }

  /**
   * Lấy danh sách tất cả dịch vụ với phân trang
   * @param page - Số trang (bắt đầu từ 1)
   * @param limit - Số lượng items mỗi trang
   * @param search - Từ khóa tìm kiếm (tùy chọn)
   * @param isActive - Lọc theo trạng thái active (tùy chọn)
   * @returns Danh sách dịch vụ với thông tin phân trang
   */
  async getAllServices(
    page: string = '1',
    limit: string = '10',
    search?: string,
    isActive?: boolean,
  ) {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || '10', 10) || 10, 1),
      100,
    );
    const skip = (pageNum - 1) * limitNum;

    // Build where condition
    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { serviceCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        select: {
          id: true,
          serviceCode: true,
          name: true,
          price: true,
          description: true,
          durationMinutes: true,
          isActive: true,
          requiresDoctor: true,
          unit: true,
          currency: true,
          category: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          specialty: {
            select: {
              id: true,
              specialtyCode: true,
              name: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ name: 'asc' }, { serviceCode: 'asc' }],
        skip,
        take: limitNum,
      }),
    ]);

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Lấy danh sách tất cả phiếu chỉ định theo người tạo
   * - DOCTOR: chỉ lấy phiếu chỉ định do bác sĩ đó tạo
   * - RECEPTIONIST: lấy tất cả phiếu chỉ định
   * @param user - Thông tin user từ JWT token
   * @param page - Số trang (bắt đầu từ 1)
   * @param limit - Số lượng items mỗi trang
   * @returns Danh sách phiếu chỉ định với thông tin phân trang
   */
  async findAll(
    user: JwtUserPayload,
    page: string = '1',
    limit: string = '10',
  ) {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || '10', 10) || 10, 1),
      100,
    );
    const skip = (pageNum - 1) * limitNum;

    // Build where condition based on user role
    const where: any = {};

    if (user.role === 'DOCTOR') {
      if (!user.doctor?.id) {
        throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
      }
      // Doctor chỉ lấy prescriptions do mình tạo
      where.doctorId = user.doctor.id;
    }
    // RECEPTIONIST và ADMIN có thể xem tất cả

    const [total, data] = await this.prisma.$transaction([
      this.prisma.prescription.count({ where }),
      this.prisma.prescription.findMany({
        where,
        include: {
          services: {
            include: { service: true },
            orderBy: { order: 'asc' as const },
          },
          medicalRecord: true,
          patientProfile: true,
          doctor: {
            include: {
              auth: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  avatar: true,
                  gender: true,
                },
              },
            },
          },
        },
        orderBy: { id: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Lấy danh sách doctors đang có work session với service cụ thể
   * @param serviceId - ID của service
   * @param serviceCode - Code của service (alternative to serviceId)
   * @returns Danh sách doctors với work session đang active
   */
  async getDoctorsByService(
    serviceId?: string,
    serviceCode?: string,
  ): Promise<
    Array<{
      doctorId: string;
      doctorCode: string;
      doctorName: string;
      boothId: string | null;
      boothCode: string | null;
      boothName: string | null;
      clinicRoomId: string | null;
      clinicRoomCode: string | null;
      clinicRoomName: string | null;
      workSessionId: string | null;
      workSessionStartTime: Date | null;
      workSessionEndTime: Date | null;
    }>
  > {
    if (!serviceId && !serviceCode) {
      throw new BadRequestException(
        'Either serviceId or serviceCode is required',
      );
    }

    // Find service
    const service = serviceId
      ? await this.prisma.service.findUnique({
          where: { id: serviceId },
          select: { id: true, serviceCode: true },
        })
      : await this.prisma.service.findUnique({
          where: { serviceCode: serviceCode! },
          select: { id: true, serviceCode: true },
        });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const currentTime = new Date();

    // Approach 1: Find through WorkSessionService (work sessions that have this service)
    const workSessionServices = await this.prisma.workSessionService.findMany({
      where: { serviceId: service.id },
      include: {
        workSession: {
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
                room: true,
              },
            },
          },
        },
      },
    });

    const doctorMap = new Map<
      string,
      {
        doctorId: string;
        doctorCode: string;
        doctorName: string;
        boothId: string | null;
        boothCode: string | null;
        boothName: string | null;
        clinicRoomId: string | null;
        clinicRoomCode: string | null;
        clinicRoomName: string | null;
        workSessionId: string | null;
        workSessionStartTime: Date | null;
        workSessionEndTime: Date | null;
      }
    >();

    // Collect from work session services (filter active sessions)
    for (const wss of workSessionServices) {
      const workSession = wss.workSession;
      if (
        workSession &&
        workSession.doctorId &&
        workSession.doctor &&
        workSession.startTime <= currentTime &&
        workSession.endTime >= currentTime &&
        (workSession.status === 'APPROVED' ||
          workSession.status === 'IN_PROGRESS')
      ) {
        const doctorId = workSession.doctorId;
        if (!doctorMap.has(doctorId)) {
          const booth = workSession.booth;
          doctorMap.set(doctorId, {
            doctorId: doctorId,
            doctorCode: workSession.doctor.doctorCode,
            doctorName: workSession.doctor.auth.name,
            boothId: booth?.id || null,
            boothCode: booth?.boothCode || null,
            boothName: booth?.name || null,
            clinicRoomId: booth?.room?.id || null,
            clinicRoomCode: booth?.room?.roomCode || null,
            clinicRoomName: booth?.room?.roomName || null,
            workSessionId: workSession.id,
            workSessionStartTime: workSession.startTime,
            workSessionEndTime: workSession.endTime,
          });
        }
      }
    }

    // Approach 2: Fallback - Find through ClinicRoomService (if no results from approach 1)
    if (doctorMap.size === 0) {
      const clinicRoomServices = await this.prisma.clinicRoomService.findMany({
        where: { serviceId: service.id },
        include: {
          clinicRoom: {
            include: {
              booth: {
                where: { isActive: true },
                include: {
                  workSessions: {
                    where: {
                      doctorId: { not: null },
                      startTime: { lte: currentTime },
                      endTime: { gte: currentTime },
                      status: {
                        in: ['APPROVED', 'IN_PROGRESS'],
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
                    },
                    orderBy: { startTime: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

      for (const crs of clinicRoomServices) {
        for (const booth of crs.clinicRoom.booth) {
          for (const workSession of booth.workSessions) {
            if (workSession.doctorId && workSession.doctor) {
              const doctorId = workSession.doctorId;
              if (!doctorMap.has(doctorId)) {
                doctorMap.set(doctorId, {
                  doctorId: doctorId,
                  doctorCode: workSession.doctor.doctorCode,
                  doctorName: workSession.doctor.auth.name,
                  boothId: booth.id,
                  boothCode: booth.boothCode,
                  boothName: booth.name,
                  clinicRoomId: crs.clinicRoomId,
                  clinicRoomCode: crs.clinicRoom.roomCode,
                  clinicRoomName: crs.clinicRoom.roomName,
                  workSessionId: workSession.id,
                  workSessionStartTime: workSession.startTime,
                  workSessionEndTime: workSession.endTime,
                });
              }
            }
          }
        }
      }
    }
    return Array.from(doctorMap.values());
  }

}
