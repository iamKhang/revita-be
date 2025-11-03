/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionStatus } from '@prisma/client';
import { CodeGeneratorService } from '../user-management/patient-profile/code-generator.service';
import { JwtUserPayload } from '../medical-record/dto/jwt-user-payload.dto';

@Injectable()
export class PrescriptionService {
  private codeGenerator = new CodeGeneratorService();

  constructor(private readonly prisma: PrismaService) {}

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

    if (!doctorId) {
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

    // Validate doctorId exists (always validate since we set it from token or DTO)
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Accept serviceId or serviceCode; resolve to IDs
    const requestedById = (services as any[])
      .filter((s: any) => !!s.serviceId)
      .map((s: any) => s.serviceId);
    const requestedByCode = (services as any[])
      .filter((s: any) => !!s.serviceCode)
      .map((s: any) => s.serviceCode);
    if (requestedById.length + requestedByCode.length !== services.length) {
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
        doctor?.auth?.name || 'Unknown',
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

    return this.prisma.prescription.findUnique({
      where: { id },
      include: {
        services: { include: { service: true }, orderBy: { order: 'asc' } },
        patientProfile: true,
        doctor: true,
      },
    });
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

    await this._startFirstPendingServiceIfNoActive(prescriptionId);

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
    // Check if user is the doctor who created this prescription
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { doctorId: true },
    });
    if (!prescription || prescription.doctorId !== user.doctor?.id) {
      throw new BadRequestException(
        'You can only modify services in prescriptions you created',
      );
    }

    // Tech confirms to start service
    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { status: PrescriptionStatus.SERVING },
    });
  }

  async markServiceWaitingResult(
    prescriptionId: string,
    serviceId: string,
    user: JwtUserPayload,
  ) {
    // Check if user is the doctor who created this prescription
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { doctorId: true },
    });
    if (!prescription || prescription.doctorId !== user.doctor?.id) {
      throw new BadRequestException(
        'You can only modify services in prescriptions you created',
      );
    }

    // Service done, waiting result, then unlock next pending service to WAITING
    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { status: PrescriptionStatus.WAITING_RESULT },
    });

    await this.unlockNextPendingService(prescriptionId);
  }

  async markServiceCompleted(
    prescriptionId: string,
    serviceId: string,
    user: JwtUserPayload,
  ) {
    // Check if user is the doctor who created this prescription
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: { doctorId: true },
    });
    if (!prescription || prescription.doctorId !== user.doctor?.id) {
      throw new BadRequestException(
        'You can only modify services in prescriptions you created',
      );
    }

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
                  const anyWorkSession =
                    await this.prisma.workSession.findFirst({
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
  }

  private async unlockNextPendingService(prescriptionId: string) {
    await this._startFirstPendingServiceIfNoActive(prescriptionId);
  }
}
