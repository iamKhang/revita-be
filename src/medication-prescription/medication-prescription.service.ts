import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DrugCatalogService } from '../drug-catalog/drug-catalog.service';
import { MedicationPrescriptionStatus } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { Role } from '../rbac/roles.enum';

@Injectable()
export class MedicationPrescriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly drugCatalog: DrugCatalogService,
    private readonly emailService: EmailService,
  ) {}

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

  async createFeedback(options: {
    prescriptionId: string;
    message: string;
    isUrgent?: boolean;
    actor: {
      authId: string;
      role: Role;
      patientId?: string | null;
      doctorId?: string | null;
    };
  }) {
    const { prescriptionId, message, isUrgent = false, actor } = options;

    const prescription = await this.prisma.medicationPrescription.findUnique({
      where: { id: prescriptionId },
      include: {
        doctor: {
          include: {
            auth: true,
          },
        },
        patientProfile: {
          include: {
            patient: {
              include: { auth: true },
            },
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Medication prescription not found');
    }

    // Only patient who owns the profile or the doctor/admin can submit
    if (actor.role === Role.PATIENT) {
      const patientId = prescription.patientProfile.patientId;
      if (!patientId || patientId !== actor.patientId) {
        throw new BadRequestException('Bạn không có quyền phản hồi đơn thuốc này');
      }
    }

    const feedback = await this.prisma.medicationPrescription.update({
      where: { id: prescription.id },
      data: {
        feedbackMessage: message,
        feedbackIsUrgent: isUrgent,
        feedbackById: actor.authId,
        feedbackByRole: actor.role,
        feedbackAt: new Date(),
      },
      include: {
        doctor: { include: { auth: true } },
        patientProfile: { include: { patient: { include: { auth: true } } } },
      },
    });

    // Send email to doctor if email exists
    const doctorEmail = prescription.doctor.auth?.email;
    if (doctorEmail) {
      const patientName =
        prescription.patientProfile?.name ||
        prescription.patientProfile?.patient?.auth?.name ||
        'Bệnh nhân';
      void this.emailService
        .sendPrescriptionFeedbackEmail({
          to: doctorEmail,
          doctorName: prescription.doctor.auth?.name,
          patientName,
          prescriptionCode: prescription.code,
          message,
          isUrgent,
          createdDate: feedback.feedbackAt
            ? feedback.feedbackAt.toISOString().split('T')[0]
            : undefined,
        })
        .catch((err) => {
          console.error('Failed to send prescription feedback email:', err);
        });
    }

    return {
      success: true,
      message: 'Đã gửi phản hồi đơn thuốc',
      data: feedback,
    };
  }

  async listFeedbackForDoctor(doctorId: string, date?: string) {
    const where: any = {
      doctorId,
      feedbackMessage: { not: null },
    };
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.feedbackAt = { gte: start, lte: end };
    }

    return this.prisma.medicationPrescription.findMany({
      where,
      orderBy: { feedbackAt: 'desc' },
      include: {
        patientProfile: true,
      },
    });
  }

  async listFeedbackForAdmin(date?: string) {
    const where: any = {
      feedbackMessage: { not: null },
    };
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.feedbackAt = { gte: start, lte: end };
    }

    return this.prisma.medicationPrescription.findMany({
      where,
      orderBy: { feedbackAt: 'desc' },
      include: {
        patientProfile: true,
        doctor: { include: { auth: true } },
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

  async listByDoctor(
    doctorId: string,
    limit = 10,
    skip = 0,
  ): Promise<{
    results: unknown[];
    total: number;
    skip: number;
    limit: number;
  }> {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const safeSkip = Math.max(0, Number(skip) || 0);

    const [results, total] = await this.prisma.$transaction([
      this.prisma.medicationPrescription.findMany({
        where: { doctorId },
        orderBy: { createdAt: 'desc' },
        include: {
          patientProfile: true,
          doctor: true,
          medicalRecord: true,
          items: { include: { drug: true } },
        },
        take: safeLimit,
        skip: safeSkip,
      }),
      this.prisma.medicationPrescription.count({ where: { doctorId } }),
    ]);

    return { results, total, skip: safeSkip, limit: safeLimit };
  }

  async listByPatientProfile(
    patientId: string,
    patientProfileId: string,
    limit = 10,
    skip = 0,
  ): Promise<{
    results: unknown[];
    total: number;
    skip: number;
    limit: number;
  }> {
    // Validate ownership: the specified profile must belong to the authenticated patient
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      select: { id: true, patientId: true },
    });
    if (!profile || (profile.patientId && profile.patientId !== patientId)) {
      throw new BadRequestException('Invalid patient profile');
    }

    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const safeSkip = Math.max(0, Number(skip) || 0);

    const [results, total] = await this.prisma.$transaction([
      this.prisma.medicationPrescription.findMany({
        where: { patientProfileId },
        orderBy: { createdAt: 'desc' },
        include: {
          patientProfile: true,
          doctor: true,
          medicalRecord: true,
          items: { include: { drug: true } },
        },
        take: safeLimit,
        skip: safeSkip,
      }),
      this.prisma.medicationPrescription.count({ where: { patientProfileId } }),
    ]);

    return { results, total, skip: safeSkip, limit: safeLimit };
  }

  // Drug catalog helpers (MongoDB)
  async searchDrugs(query: string, limit = 10, skip = 0): Promise<unknown> {
    return this.drugCatalog.search(query, limit, skip);
  }

  async searchDrugsPartial(
    query: string,
    limit = 10,
    skip = 0,
  ): Promise<unknown> {
    return this.drugCatalog.searchPartial(query, limit, skip);
  }

  // private formatDrugResponse(drug: any): any {
  //   return {
  //     id: drug.set_id,

  //     // Tên thuốc
  //     openfda: {
  //       brand_name: drug.openfda?.brand_name?.[0] || null, // tên thương mại
  //       generic_name: drug.openfda?.generic_name?.[0] || null, // tên gốc/hoạt chất chính
  //       route: drug.openfda?.route?.[0] || null, // đường dùng: uống, tiêm, nhỏ mắt…
  //       dosage_form: drug.openfda?.dosage_form?.[0] || null, // dạng bào chế: viên nén, siro, tiêm…
  //       manufacturer_name: drug.openfda?.manufacturer_name?.[0] || null, // nhà sản xuất
  //     },

  //     // Công dụng
  //     indications_and_usage: drug.indications_and_usage?.[0] || null, // chỉ định, thuốc dùng để chữa gì

  //     // Liều dùng
  //     dosage_and_administration: drug.dosage_and_administration?.[0] || null, // liều dùng & cách dùng cơ bản

  //     // Cảnh báo & chống chỉ định
  //     warnings: drug.warnings?.[0] || null, // cảnh báo quan trọng, tóm gọn
  //     contraindications: drug.contraindications?.[0] || null, // những trường hợp không được dùng

  //     // Tác dụng phụ
  //     adverse_reactions: drug.adverse_reactions?.[0] || null, // các phản ứng phụ thường gặp
  //   };
  // }

  // Removed field-based and NDC lookup in favor of full-text search

  async listByMedicalRecord(
    medicalRecordId: string,
    limit = 10,
    skip = 0,
  ): Promise<{
    results: unknown[];
    total: number;
    skip: number;
    limit: number;
  }> {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
    const safeSkip = Math.max(0, Number(skip) || 0);

    const [results, total] = await this.prisma.$transaction([
      this.prisma.medicationPrescription.findMany({
        where: { medicalRecordId },
        orderBy: { createdAt: 'desc' },
        include: {
          patientProfile: true,
          doctor: true,
          medicalRecord: true,
          items: { include: { drug: true } },
        },
        take: safeLimit,
        skip: safeSkip,
      }),
      this.prisma.medicationPrescription.count({ where: { medicalRecordId } }),
    ]);

    return { results, total, skip: safeSkip, limit: safeLimit };
  }
}
