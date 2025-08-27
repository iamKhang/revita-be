import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionStatus } from '@prisma/client';

@Injectable()
export class PrescriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePrescriptionDto) {
    const { prescriptionCode, patientProfileId, doctorId, note, serviceIds } =
      dto;

    if (!serviceIds || serviceIds.length === 0) {
      throw new BadRequestException('serviceIds must not be empty');
    }

    const prescription = await this.prisma.prescription.create({
      data: {
        prescriptionCode,
        patientProfileId,
        doctorId: doctorId ?? null,
        note: note ?? null,
        status: PrescriptionStatus.PENDING,
        services: {
          create: serviceIds.map((serviceId, index) => ({
            serviceId,
            status: PrescriptionStatus.PENDING,
            order: index + 1,
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

    // If serviceIds provided, we replace the list, reassign order, reset statuses to PENDING
    if (dto.serviceIds && dto.serviceIds.length > 0) {
      await this.prisma.prescriptionService.deleteMany({
        where: { prescriptionId: id },
      });
      await this.prisma.prescription.update({
        where: { id },
        data: {
          ...data,
          services: {
            create: dto.serviceIds.map((serviceId, index) => ({
              serviceId,
              status: PrescriptionStatus.PENDING,
              order: index + 1,
            })),
          },
          status: PrescriptionStatus.PENDING,
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
    // First service in sequence that is paid becomes WAITING if no other service is active
    const psList = await this.prisma.prescriptionService.findMany({
      where: { prescriptionId },
      orderBy: { order: 'asc' },
    });
    if (psList.length === 0) throw new NotFoundException('No services found');

    // Mark this particular service as PENDING if it was not yet set
    const current = psList.find((s) => s.serviceId === serviceId);
    if (!current) throw new NotFoundException('Service not in prescription');

    // If any service is in WAITING, SERVING, or WAITING_RESULT, do not start another
    const activeStatuses = [
      PrescriptionStatus.WAITING,
      PrescriptionStatus.SERVING,
      PrescriptionStatus.WAITING_RESULT,
    ];
    const activeExists = psList.some((s) => activeStatuses.includes(s.status as any));

    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: {
        status: activeExists
          ? PrescriptionStatus.PENDING
          : PrescriptionStatus.WAITING,
      },
    });

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
    const waitingResult = 'WAITING_RESULT' as unknown as PrescriptionStatus;
    await this.prisma.prescriptionService.update({
      where: { prescriptionId_serviceId: { prescriptionId, serviceId } },
      data: { status: waitingResult },
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

  private async unlockNextPendingService(prescriptionId: string) {
    // If no active service is WAITING/SERVING/WAITING_RESULT, set the lowest-order PENDING to WAITING
    const services = await this.prisma.prescriptionService.findMany({
      where: { prescriptionId },
      orderBy: { order: 'asc' },
    });

    const waitingResult = 'WAITING_RESULT' as unknown as PrescriptionStatus;
    const activeExists = services.some((s) =>
      [
        PrescriptionStatus.WAITING,
        PrescriptionStatus.SERVING,
        waitingResult,
      ].includes(s.status as PrescriptionStatus),
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
