import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CodeGeneratorService } from '../user-management/patient-profile/code-generator.service';

@Injectable()
export class PrescriptionService {
  private codeGenerator = new CodeGeneratorService();

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePrescriptionDto) {
    const { prescriptionCode, patientProfileId, doctorId, note, serviceIds } = dto;

    // Generate prescription code if not provided
    let finalPrescriptionCode = prescriptionCode;
    if (!finalPrescriptionCode) {
      // Get doctor and patient names for code generation
      const doctor = doctorId ? await this.prisma.doctor.findUnique({
        where: { id: doctorId },
        include: { auth: true },
      }) : null;
      
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


