import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrescriptionService } from '../prescription/prescription.service';
import { RoutingService } from '../routing/routing.service';
import { RedisStreamService } from '../cache/redis-stream.service';
import { ScanPrescriptionDto } from './dto/scan-prescription.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { PrescriptionStatus } from '@prisma/client';

export type PrescriptionDetails = {
  id: string;
  prescriptionCode: string;
  patientProfile: {
    id: string;
    name: string;
    dateOfBirth: Date;
    gender: string;
  };
  doctor?: {
    id: string;
    doctorCode: string;
    auth: { name: string };
  };
  services: Array<{
    serviceId: string;
    service: {
      id: string;
      serviceCode: string;
      name: string;
      price: number;
      description: string;
    };
    status: PrescriptionStatus;
    order: number;
  }>;
  note?: string;
  status: PrescriptionStatus;
};

export type PaymentPreview = {
  prescriptionDetails: PrescriptionDetails;
  selectedServices: Array<{
    serviceId: string;
    serviceCode: string;
    name: string;
    price: number;
    description: string;
  }>;
  totalAmount: number;
  patientName: string;
};

export type PaymentResult = {
  invoiceCode: string;
  totalAmount: number;
  paymentStatus: string;
  prescriptionId: string;
  patientProfileId: string;
  selectedServiceIds: string[];
  routingAssignments?: Array<{
    roomId: string;
    roomCode: string;
    roomName: string;
    specialtyName?: string;
    boothId?: string;
    boothCode?: string;
    boothName?: string;
    doctorId?: string;
    doctorCode?: string;
    doctorName?: string;
    nextAvailableAt?: Date;
  }>;
  invoiceDetails?: Array<{
    serviceId: string;
    serviceCode: string;
    serviceName: string;
    price: number;
  }>;
  patientInfo?: {
    name: string;
    dateOfBirth: Date;
    gender: string;
  };
  prescriptionInfo?: {
    prescriptionCode: string;
    status: string;
    doctorName?: string;
  };
};

@Injectable()
export class InvoicePaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prescriptionService: PrescriptionService,
    private readonly routingService: RoutingService,
    private readonly redisStream: RedisStreamService,
  ) {}

  private async resolveCashierId(identifier?: string): Promise<string> {
    if (!identifier) {
      throw new BadRequestException('Cashier identifier is required');
    }
    // Try direct cashier.id first
    const byId = await this.prisma.cashier.findUnique({
      where: { id: identifier },
    });
    if (byId) return byId.id;
    // Then try by authId
    const byAuth = await this.prisma.cashier.findFirst({
      where: { authId: identifier },
    });
    if (byAuth) return byAuth.id;
    throw new BadRequestException('Invalid cashier identifier');
  }

  async scanPrescription(
    dto: ScanPrescriptionDto,
  ): Promise<PrescriptionDetails> {
    const prescription = await this.prisma.prescription.findFirst({
      where: { prescriptionCode: dto.prescriptionCode },
      include: {
        patientProfile: true,
        doctor: {
          include: { auth: true },
        },
        services: {
          include: { service: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    if (prescription.status === PrescriptionStatus.CANCELLED) {
      throw new BadRequestException('Prescription has been cancelled');
    }

    return prescription as PrescriptionDetails;
  }

  async createPaymentPreview(dto: CreatePaymentDto): Promise<PaymentPreview> {
    const prescription = await this.scanPrescription({
      prescriptionCode: dto.prescriptionCode,
    });

    // Determine selected services: if none provided, default to all
    let selectedIds: string[] = [];
    const allIds = prescription.services.map((s) => s.serviceId);
    const codeToId = new Map(
      prescription.services.map(
        (s) => [s.service.serviceCode, s.serviceId] as const,
      ),
    );

    if (
      (dto.selectedServiceIds && dto.selectedServiceIds.length > 0) ||
      (dto.selectedServiceCodes && dto.selectedServiceCodes.length > 0)
    ) {
      const idsFromIds = dto.selectedServiceIds || [];
      const idsFromCodes = (dto.selectedServiceCodes || [])
        .map((code) => codeToId.get(code))
        .filter(Boolean) as string[];
      selectedIds = Array.from(new Set([...idsFromIds, ...idsFromCodes]));

      // Validate selection in prescription
      const invalidIds = selectedIds.filter((id) => !allIds.includes(id));
      if (invalidIds.length > 0) {
        throw new BadRequestException(
          `Services not found in prescription: ${invalidIds.join(', ')}`,
        );
      }
    } else {
      selectedIds = allIds;
    }

    // Get selected services with their details
    const selectedServices = prescription.services
      .filter((s) => selectedIds.includes(s.serviceId))
      .map((s) => ({
        serviceId: s.serviceId,
        serviceCode: s.service.serviceCode,
        name: s.service.name,
        price: s.service.price,
        description: s.service.description,
      }));

    const totalAmount = selectedServices.reduce(
      (sum, service) => sum + service.price,
      0,
    );

    return {
      prescriptionDetails: prescription,
      selectedServices,
      totalAmount,
      patientName: prescription.patientProfile.name,
    };
  }

  async createPayment(dto: CreatePaymentDto): Promise<PaymentResult> {
    const preview = await this.createPaymentPreview(dto);
    const effectiveCashierId = await this.resolveCashierId(dto.cashierId);
    const prescription = preview.prescriptionDetails;

    // Check if there are available work sessions for the requested services
    const currentTime = new Date();
    const availableAssignments = await this.routingService.assignPatientToRooms(
      {
        patientProfileId: prescription.patientProfile.id,
        serviceIds: preview.selectedServices.map((s) => s.serviceId),
        requestedTime: currentTime,
      },
    );

    if (availableAssignments.length === 0) {
      throw new BadRequestException(
        'Hiện tại chưa có nhân sự để phục vụ cho các dịch vụ đã chọn. Vui lòng thử lại sau hoặc liên hệ quầy tiếp tân để được hỗ trợ.',
      );
    }

    // Generate invoice code
    const invoiceCode = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceCode,
        totalAmount: preview.totalAmount,
        paymentMethod: dto.paymentMethod,
        paymentStatus: 'PENDING',
        isPaid: false,
        patientProfileId: prescription.patientProfile.id,
        cashierId: effectiveCashierId,
        invoiceDetails: {
          create: preview.selectedServices.map((service) => ({
            serviceId: service.serviceId,
            price: service.price,
            prescriptionId: prescription.id,
          })),
        },
      },
      include: {
        invoiceDetails: {
          include: { service: true },
        },
      },
    });

    return {
      invoiceCode: invoice.invoiceCode,
      totalAmount: invoice.totalAmount,
      paymentStatus: invoice.paymentStatus,
      prescriptionId: prescription.id,
      patientProfileId: prescription.patientProfile.id,
      selectedServiceIds: preview.selectedServices.map((s) => s.serviceId),
    };
  }

  async confirmPayment(
    dto: ConfirmPaymentDto,
  ): Promise<PaymentResult & { routingAssignments: any[] }> {
    // Find and update invoice
    const invoice = await this.prisma.invoice.findFirst({
      where: { invoiceCode: dto.invoiceCode },
      include: {
        invoiceDetails: {
          include: { service: true },
        },
        patientProfile: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.isPaid) {
      throw new BadRequestException('Invoice has already been paid');
    }

    // Update invoice to paid
    const effectiveCashierId = await this.resolveCashierId(
      (dto as any).cashierId,
    );
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paymentStatus: 'PAID',
        isPaid: true,
        cashierId: effectiveCashierId,
      },
    });

    // Get prescription details
    const prescriptionId = invoice.invoiceDetails[0]?.prescriptionId;
    if (!prescriptionId) {
      throw new NotFoundException(
        'Prescription ID not found in invoice details',
      );
    }

    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId },
      include: {
        services: {
          include: { service: true },
          orderBy: { order: 'asc' },
        },
        doctor: {
          include: { auth: true },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    // Mark paid services in prescription
    const selectedServiceIds = invoice.invoiceDetails.map(
      (detail) => detail.serviceId,
    );

    // Get all service IDs from the prescription
    const allPrescriptionServiceIds = prescription.services.map(
      (s) => s.serviceId,
    );

    // Find services that were in the prescription but not selected for payment in THIS invoice
    const unselectedServiceIds = allPrescriptionServiceIds.filter(
      (id) => !selectedServiceIds.includes(id),
    );

    // Only cancel services that are still PENDING (not yet paid in previous invoices)
    const pendingUnselectedIds: string[] = [];
    for (const serviceId of unselectedServiceIds) {
      const service = prescription.services.find(
        (s) => s.serviceId === serviceId,
      );
      if (service && service.status === 'PENDING') {
        pendingUnselectedIds.push(serviceId);
      }
    }

    // Cancel only pending unselected services
    if (pendingUnselectedIds.length > 0) {
      await this.prisma.prescriptionService.updateMany({
        where: {
          prescriptionId,
          serviceId: { in: pendingUnselectedIds },
        },
        data: { status: 'CANCELLED' },
      });
    }

    // Mark selected services as paid (which will set the first one to WAITING if no active service)
    for (const serviceId of selectedServiceIds) {
      await this.prescriptionService.markServicePaid(
        prescription.id,
        serviceId,
      );
    }

    // Route patient to appropriate rooms
    let routingAssignments: any[] = [];
    try {
      const routingResult = await this.routingService.assignPatientToRooms({
        patientProfileId: invoice.patientProfileId,
        serviceIds: selectedServiceIds,
        requestedTime: new Date(),
      });
      routingAssignments = routingResult || [];
    } catch (error) {
      console.warn('Routing failed:', error);
      // Continue with payment even if routing fails
    }

    // Get detailed routing information
    const detailedRoutingAssignments = routingAssignments.map((assignment) => ({
      roomId: assignment.roomId,
      roomCode: assignment.roomCode,
      roomName: assignment.roomName,
      specialtyName: assignment.specialtyName,
      boothId: assignment.boothId,
      boothCode: assignment.boothCode,
      boothName: assignment.boothName,
      doctorId: assignment.doctorId,
      doctorCode: assignment.doctorCode,
      doctorName: assignment.doctorName,
      technicianId: assignment.technicianId,
      technicianCode: assignment.technicianCode,
      technicianName: assignment.technicianName,
      nextAvailableAt: assignment.nextAvailableAt,
    }));

    // Publish patient assignment to Redis Stream for each room
    const streamKey = process.env.REDIS_STREAM_ASSIGNMENTS || 'clinic:assignments';
    try {
      for (const assignment of detailedRoutingAssignments) {
        await this.redisStream.publishEvent(streamKey, {
          type: 'PATIENT_ASSIGNED',
          patientProfileId: invoice.patientProfileId,
          patientName: invoice.patientProfile.name,
          status: 'WAITING',
          roomId: assignment.roomId,
          roomCode: assignment.roomCode,
          roomName: assignment.roomName,
          boothId: assignment.boothId || '',
          boothCode: assignment.boothCode || '',
          boothName: assignment.boothName || '',
          doctorId: assignment.doctorId || '',
          doctorCode: assignment.doctorCode || '',
          doctorName: assignment.doctorName || '',
          technicianId: assignment.technicianId || '',
          technicianCode: assignment.technicianCode || '',
          technicianName: assignment.technicianName || '',
          serviceIds: selectedServiceIds.join(','),
          prescriptionId: prescription.id,
          prescriptionCode: prescription.prescriptionCode,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn(
        '[Redis Stream] Patient assignment publish failed:',
        (err as Error).message,
      );
    }



    return {
      invoiceCode: invoice.invoiceCode,
      totalAmount: invoice.totalAmount,
      paymentStatus: 'PAID',
      prescriptionId: prescription.id,
      patientProfileId: invoice.patientProfileId,
      selectedServiceIds,
      routingAssignments: detailedRoutingAssignments,
      invoiceDetails: invoice.invoiceDetails.map((detail) => ({
        serviceId: detail.serviceId,
        serviceCode: detail.service.serviceCode,
        serviceName: detail.service.name,
        price: detail.price,
      })),
      patientInfo: {
        name: invoice.patientProfile.name,
        dateOfBirth: invoice.patientProfile.dateOfBirth,
        gender: invoice.patientProfile.gender,
      },
      prescriptionInfo: {
        prescriptionCode: prescription.prescriptionCode,
        status: prescription.status,
        doctorName: prescription.doctor?.auth.name,
      },
    };
  }

  async getPaymentHistory(patientProfileId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { patientProfileId },
      include: {
        invoiceDetails: {
          include: {
            service: true,
            prescription: {
              include: {
                services: {
                  include: { service: true },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map((invoice) => ({
      invoiceCode: invoice.invoiceCode,
      totalAmount: invoice.totalAmount,
      paymentStatus: invoice.paymentStatus,
      paymentMethod: invoice.paymentMethod,
      isPaid: invoice.isPaid,
      createdAt: invoice.createdAt,
      services: invoice.invoiceDetails.map((detail) => ({
        serviceId: detail.serviceId,
        serviceCode: detail.service.serviceCode,
        name: detail.service.name,
        price: detail.price,
        prescriptionId: detail.prescriptionId,
      })),
    }));
  }

  async getPrescriptionStatus(prescriptionCode: string) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { prescriptionCode },
      include: {
        services: {
          include: { service: true },
          orderBy: { order: 'asc' },
        },
        patientProfile: true,
        doctor: {
          include: { auth: true },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    return {
      prescriptionCode: prescription.prescriptionCode,
      status: prescription.status,
      patientName: prescription.patientProfile.name,
      doctorName: prescription.doctor?.auth.name,
      services: prescription.services.map((service) => ({
        serviceCode: service.service.serviceCode,
        name: service.service.name,
        status: service.status,
        order: service.order,
      })),
      note: prescription.note,
    };
  }
}
