import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionStatus } from '@prisma/client';

@Injectable()
export class PrescriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePrescriptionDto) {
    const { prescriptionCode, patientProfileId, doctorId, note, services, medicalRecordId } = dto as any;
    console.log('Creating prescription with data:', { prescriptionCode, patientProfileId, doctorId, note, services, medicalRecordId });
    const generatedCode = prescriptionCode || `PR-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;

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
    const requestedById = services.filter((s: any) => !!s.serviceId).map((s: any) => s.serviceId);
    const requestedByCode = services.filter((s: any) => !!s.serviceCode).map((s: any) => s.serviceCode);
    if (requestedById.length + requestedByCode.length !== services.length) {
      throw new BadRequestException('Each service must include serviceId or serviceCode');
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
    const codeToId = new Map(servicesByCode.map((s) => [s.serviceCode, s.id] as const));
    const missingIds = requestedById.filter((id) => !idSet.has(id));
    const missingCodes = requestedByCode.filter((code) => !codeToId.has(code));
    if (missingIds.length || missingCodes.length) {
      const parts = [] as string[];
      if (missingIds.length) parts.push(`serviceId(s): ${missingIds.join(', ')}`);
      if (missingCodes.length) parts.push(`serviceCode(s): ${missingCodes.join(', ')}`);
      throw new BadRequestException(`Invalid ${parts.join(' and ')}`);
    }

    // Optional: validate medicalRecord belongs to same patientProfile
    if (medicalRecordId) {
      const mr = await this.prisma.medicalRecord.findUnique({
        where: { id: medicalRecordId },
        select: { id: true, patientProfileId: true },
      });
      if (!mr) throw new NotFoundException('Medical record not found');
      if (mr.patientProfileId !== patientProfileId) {
        throw new BadRequestException('medicalRecordId does not belong to the provided patientProfileId');
      }
    }

    const prescription = await this.prisma.prescription.create({
      data: {
        prescriptionCode: generatedCode,
        patientProfileId,
        doctorId: doctorId ?? null,
        medicalRecordId: medicalRecordId ?? null,
        note: note ?? null,
        services: {
          create: services.map((s, index) => ({
            serviceId: s.serviceId ?? codeToId.get(s.serviceCode as string)!,
            status: (s.status as any) || PrescriptionStatus.NOT_STARTED,
            order: s.order ?? index + 1,
            note: s.note ?? null,
          })),
        },
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

  async update(id: string, dto: UpdatePrescriptionDto) {
    const existing = await this.prisma.prescription.findUnique({
      where: { id },
      include: { services: true },
    });
    if (!existing) throw new NotFoundException('Prescription not found');

    // Basic fields
    const data: any = {
      doctorId: dto.doctorId ?? existing.doctorId,
      note: dto.note ?? existing.note,
    };

    // If services provided, validate and then replace the list using provided objects
    if (dto.services && dto.services.length > 0) {
      const requestedById = dto.services.filter((s: any) => !!s.serviceId).map((s: any) => s.serviceId);
      const requestedByCode = dto.services.filter((s: any) => !!s.serviceCode).map((s: any) => s.serviceCode);
      if (requestedById.length + requestedByCode.length !== dto.services.length) {
        throw new BadRequestException('Each service must include serviceId or serviceCode');
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
      const codeToId = new Map(servicesByCode.map((s) => [s.serviceCode, s.id] as const));
      const missingIds = requestedById.filter((sid) => !idSet.has(sid));
      const missingCodes = requestedByCode.filter((code) => !codeToId.has(code));
      if (missingIds.length || missingCodes.length) {
        const parts = [] as string[];
        if (missingIds.length) parts.push(`serviceId(s): ${missingIds.join(', ')}`);
        if (missingCodes.length) parts.push(`serviceCode(s): ${missingCodes.join(', ')}`);
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
            })),
          },
        },
      });
    } else {
      await this.prisma.prescription.update({ where: { id }, data });
    }

    return this.prisma.prescription.findUnique({
      where: { id },
      include: {
        services: { include: { service: true }, orderBy: { order: 'asc' } },
        patientProfile: true,
        doctor: true,
      },
    });
  }

  async cancel(id: string) {
    const existing = await this.prisma.prescription.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Prescription not found');

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

    return { id, status: PrescriptionStatus.CANCELLED };
  }

  // Below are internal methods for status transitions. Expose later when integrating.

  async markServicePaid(prescriptionId: string, serviceId: string) {
    // Called after payment success for a given service
    // Mark the paid service as PENDING, then check if we should start the first available service
    const psList = await this.prisma.prescriptionService.findMany({
      where: { prescriptionId },
      orderBy: { order: 'asc' },
    });
    if (psList.length === 0) throw new NotFoundException('No services found');

    const current = psList.find((s) => s.serviceId === serviceId);
    if (!current) throw new NotFoundException('Service not in prescription');

    // Mark this particular service as PENDING (paid but not yet started)
    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { status: PrescriptionStatus.PENDING },
    });

    // Check if any service is currently active (WAITING, SERVING, WAITING_RESULT)
    const activeStatuses = [
      PrescriptionStatus.WAITING,
      PrescriptionStatus.SERVING,
      PrescriptionStatus.WAITING_RESULT,
    ];
    const activeExists = psList.some((s) => activeStatuses.includes(s.status as any));

    // If no active service, start the first PENDING service in order
    if (!activeExists) {
      // Find the service with lowest order that is PENDING (paid)
      const firstPendingService = psList
        .filter((s) => s.status === PrescriptionStatus.PENDING)
        .sort((a, b) => a.order - b.order)[0];

      if (firstPendingService) {
        // Try to assign the service to a technician/doctor based on routing
        let assignedDoctorId: string | null = null;
        let assignedTechnicianId: string | null = null;
        
        try {
          // Get the service details to find which room it should go to
          const service = await this.prisma.service.findUnique({
            where: { id: firstPendingService.serviceId },
            include: {
              clinicRoomServices: {
                include: {
                  clinicRoom: {
                    include: {
                      booth: {
                        include: {
                          workSessions: {
                            where: {
                              startTime: { lte: new Date() },
                              endTime: { gte: new Date() },
                            },
                            include: {
                              doctor: true,
                              technician: true,
                            },
                            orderBy: { startTime: 'desc' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          });
          
          if (service && service.clinicRoomServices.length > 0) {
            // Find the first available booth with active work session
            for (const crs of service.clinicRoomServices) {
              for (const booth of crs.clinicRoom.booth) {
                if (booth.workSessions.length > 0) {
                  const workSession = booth.workSessions[0];
                  assignedDoctorId = workSession.doctorId;
                  assignedTechnicianId = workSession.technicianId;
                  break;
                }
              }
              if (assignedDoctorId || assignedTechnicianId) break;
            }
            
            // If no active work session, try to find any work session for fallback
            if (!assignedDoctorId && !assignedTechnicianId) {
              for (const crs of service.clinicRoomServices) {
                for (const booth of crs.clinicRoom.booth) {
                  const anyWorkSession = await this.prisma.workSession.findFirst({
                    where: { boothId: booth.id },
                    include: {
                      doctor: true,
                      technician: true,
                    },
                    orderBy: { startTime: 'desc' },
                  });
                  
                  if (anyWorkSession) {
                    assignedDoctorId = anyWorkSession.doctorId;
                    assignedTechnicianId = anyWorkSession.technicianId;
                    break;
                  }
                }
                if (assignedDoctorId || assignedTechnicianId) break;
              }
            }
          }
        } catch (error) {
          console.warn('Failed to assign service to technician/doctor:', error);
        }
        
        await this.prisma.prescriptionService.update({
          where: {
            prescriptionId_serviceId: {
              prescriptionId,
              serviceId: firstPendingService.serviceId,
            },
          },
          data: { 
            status: PrescriptionStatus.WAITING,
            doctorId: assignedDoctorId,
            technicianId: assignedTechnicianId,
          },
        });
      }
    }

    // Ensure prescription is at least PENDING
    await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: { status: PrescriptionStatus.PENDING },
    });
  }

  async markServiceServing(prescriptionId: string, serviceId: string) {
    // Tech confirms to start service
    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { status: PrescriptionStatus.SERVING },
    });
  }

  async markServiceWaitingResult(prescriptionId: string, serviceId: string) {
    // Service done, waiting result, then unlock next pending service to WAITING
    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { status: PrescriptionStatus.WAITING_RESULT },
    });

    await this.unlockNextPendingService(prescriptionId);
  }

  async markServiceCompleted(prescriptionId: string, serviceId: string) {
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
  }

  async getPrescriptionsByMedicalRecord(medicalRecordId: string) {
    console.log('Searching for prescriptions with medicalRecordId:', medicalRecordId);
    
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

    console.log('Found prescriptions:', prescriptions.length);
    console.log('Prescriptions:', prescriptions);

    return prescriptions;
  }

  private async unlockNextPendingService(prescriptionId: string) {
    // If no active service is WAITING/SERVING/WAITING_RESULT, set the lowest-order PENDING to WAITING
    const services = await this.prisma.prescriptionService.findMany({
      where: { prescriptionId },
      orderBy: { order: 'asc' },
    });

    const activeExists = services.some((s) =>
      [
        PrescriptionStatus.WAITING,
        PrescriptionStatus.SERVING,
        PrescriptionStatus.WAITING_RESULT,
      ].includes(s.status as any),
    );
    if (activeExists) return;

    const next = services.find((s) => s.status === PrescriptionStatus.PENDING);
    if (next) {
      await this.prisma.prescriptionService.update({
        where: {
          prescriptionId_serviceId: {
            prescriptionId,
            serviceId: next.serviceId,
          },
        },
        data: { status: PrescriptionStatus.WAITING },
      });
    }
  }
}
