import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrescriptionService } from '../prescription/prescription.service';
import { RoutingService } from '../routing/routing.service';
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
  routingAssignments?: any[];
};

@Injectable()
export class InvoicePaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prescriptionService: PrescriptionService,
    private readonly routingService: RoutingService,
  ) {}

  async scanPrescription(dto: ScanPrescriptionDto): Promise<PrescriptionDetails> {
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

    // Validate that all selected services exist in the prescription
    const prescriptionServiceIds = prescription.services.map(s => s.serviceId);
    const invalidServices = dto.selectedServiceIds.filter(
      id => !prescriptionServiceIds.includes(id)
    );

    if (invalidServices.length > 0) {
      throw new BadRequestException(
        `Services not found in prescription: ${invalidServices.join(', ')}`
      );
    }

    // Get selected services with their details
    const selectedServices = prescription.services
      .filter(s => dto.selectedServiceIds.includes(s.serviceId))
      .map(s => ({
        serviceId: s.serviceId,
        serviceCode: s.service.serviceCode,
        name: s.service.name,
        price: s.service.price,
        description: s.service.description,
      }));

    const totalAmount = selectedServices.reduce((sum, service) => sum + service.price, 0);

    return {
      prescriptionDetails: prescription,
      selectedServices,
      totalAmount,
      patientName: prescription.patientProfile.name,
    };
  }

  async createPayment(dto: CreatePaymentDto): Promise<PaymentResult> {
    const preview = await this.createPaymentPreview(dto);
    const prescription = preview.prescriptionDetails;

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
        cashierId: dto.cashierId || 'system', // Fallback for testing
        invoiceDetails: {
          create: preview.selectedServices.map(service => ({
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
      selectedServiceIds: dto.selectedServiceIds,
    };
  }

  async confirmPayment(dto: ConfirmPaymentDto): Promise<PaymentResult & { routingAssignments: any[] }> {
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
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paymentStatus: 'PAID',
        isPaid: true,
        cashierId: dto.cashierId,
      },
    });

    // Get prescription details
    const prescriptionId = invoice.invoiceDetails[0]?.prescriptionId;
    if (!prescriptionId) {
      throw new NotFoundException('Prescription ID not found in invoice details');
    }

    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId },
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

    // Mark paid services in prescription
    const selectedServiceIds = invoice.invoiceDetails.map(detail => detail.serviceId);
    
    for (const serviceId of selectedServiceIds) {
      await this.prescriptionService.markServicePaid(prescription.id, serviceId);
    }

    // Route patient to appropriate rooms
    let routingAssignments: any[] = [];
    try {
      const routingResult = await this.routingService.assignPatientToRooms({
        patientProfileId: invoice.patientProfileId,
        serviceIds: selectedServiceIds,
        requestedTime: new Date(),
      });
      routingAssignments = routingResult;
    } catch (error) {
      console.warn('Routing failed:', error);
      // Continue with payment even if routing fails
    }

    return {
      invoiceCode: invoice.invoiceCode,
      totalAmount: invoice.totalAmount,
      paymentStatus: 'PAID',
      prescriptionId: prescription.id,
      patientProfileId: invoice.patientProfileId,
      selectedServiceIds,
      routingAssignments,
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

    return invoices.map(invoice => ({
      invoiceCode: invoice.invoiceCode,
      totalAmount: invoice.totalAmount,
      paymentStatus: invoice.paymentStatus,
      paymentMethod: invoice.paymentMethod,
      isPaid: invoice.isPaid,
      createdAt: invoice.createdAt,
      services: invoice.invoiceDetails.map(detail => ({
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
      services: prescription.services.map(service => ({
        serviceCode: service.service.serviceCode,
        name: service.service.name,
        status: service.status,
        order: service.order,
      })),
      note: prescription.note,
    };
  }
}
