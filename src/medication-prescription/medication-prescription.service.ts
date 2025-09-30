/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { MedicationPrescriptionStatus } from '@prisma/client';

@Injectable()
export class MedicationPrescriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    code?: string;
    doctorId: string;
    patientProfileId: string;
    medicalRecordId?: string | null;
    note?: string | null;
    status?: MedicationPrescriptionStatus;
    items: Array<{
      drugId?: string;
      name: string;
      ndc?: string;
      strength?: string;
      dosageForm?: string;
      route?: string;
      dose?: number;
      doseUnit?: string;
      frequency?: string;
      durationDays?: number;
      quantity?: number;
      quantityUnit?: string;
      instructions?: string;
    }>;
  }): Promise<unknown> {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('items must not be empty');
    }

    return await this.prisma.medicationPrescription.create({
      data: {
        code: data.code ?? `MP-${Date.now()}`,
        doctorId: data.doctorId,
        patientProfileId: data.patientProfileId,
        medicalRecordId: data.medicalRecordId ?? null,
        note: data.note ?? null,
        status: data.status ?? MedicationPrescriptionStatus.DRAFT,
        items: {
          create: data.items.map((i) => ({
            drugId: i.drugId ?? null,
            name: i.name,
            ndc: i.ndc ?? null,
            strength: i.strength ?? null,
            dosageForm: i.dosageForm ?? null,
            route: i.route ?? null,
            dose: i.dose ?? null,
            doseUnit: i.doseUnit ?? null,
            frequency: i.frequency ?? null,
            durationDays: i.durationDays ?? null,
            quantity: i.quantity ?? null,
            quantityUnit: i.quantityUnit ?? null,
            instructions: i.instructions ?? null,
          })),
        },
      },
      include: {
        patientProfile: true,
        doctor: true,
        medicalRecord: true,
        items: { include: { drug: true } },
      },
    });
  }

  async findByCode(code: string): Promise<unknown> {
    const mp = await this.prisma.medicationPrescription.findUnique({
      where: { code },
      include: {
        patientProfile: true,
        doctor: true,
        medicalRecord: true,
        items: { include: { drug: true } },
      },
    });
    if (!mp) throw new NotFoundException('Medication prescription not found');
    return mp;
  }

  async update(
    id: string,
    data: Partial<{
      note: string | null;
      status: MedicationPrescriptionStatus;
      items: Array<{
        drugId?: string;
        name: string;
        ndc?: string;
        strength?: string;
        dosageForm?: string;
        route?: string;
        dose?: number;
        doseUnit?: string;
        frequency?: string;
        durationDays?: number;
        quantity?: number;
        quantityUnit?: string;
        instructions?: string;
      }>;
    }>,
  ): Promise<unknown> {
    const existing = await this.prisma.medicationPrescription.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException('Medication prescription not found');

    await this.prisma.medicationPrescription.update({
      where: { id },
      data: {
        note: data.note ?? existing.note,
        status: data.status ?? existing['status'],
      },
    });

    if (data.items) {
      await this.prisma.medicationPrescriptionItem.deleteMany({
        where: { prescriptionId: id },
      });
      if (data.items.length > 0) {
        await this.prisma.medicationPrescriptionItem.createMany({
          data: data.items.map((i) => ({
            prescriptionId: id,
            drugId: i.drugId ?? null,
            name: i.name,
            ndc: i.ndc ?? null,
            strength: i.strength ?? null,
            dosageForm: i.dosageForm ?? null,
            route: i.route ?? null,
            dose: i.dose ?? null,
            doseUnit: i.doseUnit ?? null,
            frequency: i.frequency ?? null,
            durationDays: i.durationDays ?? null,
            quantity: i.quantity ?? null,
            quantityUnit: i.quantityUnit ?? null,
            instructions: i.instructions ?? null,
          })),
        });
      }
    }

    return this.findByCode(existing.code);
  }

  async delete(id: string): Promise<{ id: string; deleted: boolean }> {
    await this.prisma.medicationPrescription.delete({ where: { id } });
    return { id, deleted: true };
  }

  // OpenFDA helpers
  async searchDrugs(query: string, limit = 10, skip = 0): Promise<unknown> {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const safeSkip = Math.max(0, Number(skip) || 0);
    const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(
      query,
    )}&limit=${safeLimit}&skip=${safeSkip}`;
    const res = await axios.get(url);
    return res.data;
  }

  async getDrugByNdc(ndc: string): Promise<unknown> {
    const url = `https://api.fda.gov/drug/ndc.json?search=product_ndc:${encodeURIComponent(ndc)}&limit=1`;
    const res = await axios.get(url);
    return res.data;
  }
}
