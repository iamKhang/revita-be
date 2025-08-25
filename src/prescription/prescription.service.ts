import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';

@Injectable()
export class PrescriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePrescriptionDto) {
    const { prescriptionCode, patientProfileId, doctorId, note, serviceIds } = dto;

    const prescription = await this.prisma.prescription.create({
      data: {
        prescriptionCode,
        patientProfileId,
        doctorId: doctorId ?? null,
        note: note ?? null,
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId })),
        },
      },
      include: {
        services: {
          include: { service: true },
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
        services: { include: { service: true } },
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
}


