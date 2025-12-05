/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrescriptionService } from '../prescription/prescription.service';
import { RoutingService } from '../routing/routing.service';
import { RedisStreamService } from '../cache/redis-stream.service';
import { WebSocketService } from '../websocket/websocket.service';
import { ScanPrescriptionDto } from './dto/scan-prescription.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import {
  Invoice,
  PaymentMethod,
  PaymentTransaction,
  PaymentTransactionStatus,
  PrescriptionStatus,
} from '@prisma/client';
import { PayOsService } from '../payos/payos.service';
import {
  LoyaltyDiscountConstraints,
  LoyaltyDiscountResult,
  LoyaltyService,
} from './loyalty.service';

type ServicePromotionSnapshot = {
  id: string;
  name?: string | null;
  description?: string | null;
  allowLoyaltyDiscount: boolean;
  maxDiscountPercent?: number | null;
  maxDiscountAmount?: number | null;
  isActive: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
};

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
    id: string; // ID của PrescriptionService
    serviceId: string;
    service: {
      id: string;
      serviceCode: string;
      name: string;
      price: number;
      description: string;
      promotion?: ServicePromotionSnapshot | null;
    };
    status: PrescriptionStatus;
    order: number;
  }>;
  note?: string;
  status: PrescriptionStatus;
};

export type DiscountedServicePreview = {
  prescriptionServiceId: string;
  serviceId: string;
  serviceCode: string;
  name: string;
  price: number;
  originalPrice: number;
  discountAmount: number;
  promotionDiscountAmount: number;
  loyaltyDiscountAmount: number;
  discountPercent: number;
  description: string;
  discountReason?: string | null;
  promotionId?: string | null;
  promotionName?: string | null;
};

export type PaymentPreview = {
  prescriptionDetails: PrescriptionDetails;
  selectedServices: DiscountedServicePreview[];
  totalAmount: number;
  originalTotalAmount: number;
  totalDiscountAmount: number;
  discountReasonSummary?: string | null;
  patientName: string;
  loyaltyInfo?: {
    totalPoints: number;
    tierInfo: {
      tier: string;
      name: string;
      discountPercent: number;
      minPoints: number;
      nextTierPoints?: number;
    };
  };
};

export type PaymentTransactionSummary = {
  id: string;
  status: PaymentTransactionStatus;
  amount: number;
  currency?: string | null;
  paymentUrl?: string | null;
  qrCode?: string | null;
  providerTransactionId?: string | null;
  orderCode?: string | null;
  expiredAt?: Date | null;
  paidAt?: Date | null;
  isVerified?: boolean;
};

export type PaymentResult = {
  invoiceCode: string;
  totalAmount: number;
  originalTotalAmount?: number | null;
  totalDiscountAmount?: number | null;
  discountReason?: string | null;
  paymentStatus: string;
  prescriptionId: string;
  patientProfileId: string;
  selectedServiceIds: string[];
  paymentMethod: PaymentMethod;
  transaction?: PaymentTransactionSummary;
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
    originalPrice?: number | null;
    discountAmount?: number | null;
    discountReason?: string | null;
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
  private readonly logger = new Logger(InvoicePaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prescriptionService: PrescriptionService,
    private readonly routingService: RoutingService,
    private readonly loyaltyService: LoyaltyService,
    private readonly redisStream: RedisStreamService,
    private readonly payOsService: PayOsService,
    private readonly webSocketService: WebSocketService,
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
          include: {
            service: {
              include: {
                promotion: true,
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

    if (prescription.status === PrescriptionStatus.CANCELLED) {
      throw new BadRequestException('Prescription has been cancelled');
    }

    return prescription as PrescriptionDetails;
  }

  private async getPrescriptionById(
    prescriptionId: string,
  ): Promise<PrescriptionDetails> {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId },
      include: {
        patientProfile: true,
        doctor: {
          include: { auth: true },
        },
        services: {
          include: {
            service: {
              include: {
                promotion: true,
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

    return prescription as PrescriptionDetails;
  }

  async createPaymentPreview(dto: CreatePaymentDto): Promise<PaymentPreview> {
    const prescription = await this.scanPrescription({
      prescriptionCode: dto.prescriptionCode,
    });

    // Determine selected services: if none provided, default to all
    // Note: selectedServiceIds/selectedServiceCodes can refer to either PrescriptionService.id or Service.id
    let selectedPrescriptionServiceIds: string[] = [];
    const allPrescriptionServiceIds = prescription.services.map((s) => s.id);
    const allServiceIds = prescription.services.map((s) => s.serviceId);
    const codeToPrescriptionServiceId = new Map(
      prescription.services.map((s) => [s.service.serviceCode, s.id] as const),
    );
    const serviceIdToPrescriptionServiceIds = new Map<string, string[]>();
    prescription.services.forEach((s) => {
      const existing = serviceIdToPrescriptionServiceIds.get(s.serviceId) || [];
      existing.push(s.id);
      serviceIdToPrescriptionServiceIds.set(s.serviceId, existing);
    });

    if (
      (dto.selectedServiceIds && dto.selectedServiceIds.length > 0) ||
      (dto.selectedServiceCodes && dto.selectedServiceCodes.length > 0)
    ) {
      const idsFromIds = dto.selectedServiceIds || [];
      const idsFromCodes = (dto.selectedServiceCodes || [])
        .map((code) => codeToPrescriptionServiceId.get(code))
        .filter(Boolean) as string[];

      // Check if IDs are PrescriptionService IDs or Service IDs
      const prescriptionServiceIds: string[] = [];

      [...idsFromIds, ...idsFromCodes].forEach((id) => {
        if (allPrescriptionServiceIds.includes(id)) {
          prescriptionServiceIds.push(id);
        } else if (allServiceIds.includes(id)) {
          // If it's a Service ID, get all PrescriptionService IDs for that service
          const psIds = serviceIdToPrescriptionServiceIds.get(id) || [];
          prescriptionServiceIds.push(...psIds);
        }
      });

      selectedPrescriptionServiceIds = Array.from(
        new Set(prescriptionServiceIds),
      );

      // Validate selection in prescription
      const invalidIds = selectedPrescriptionServiceIds.filter(
        (id) => !allPrescriptionServiceIds.includes(id),
      );
      if (invalidIds.length > 0) {
        throw new BadRequestException(
          `Services not found in prescription: ${invalidIds.join(', ')}`,
        );
      }
    } else {
      selectedPrescriptionServiceIds = allPrescriptionServiceIds;
    }

    // Lấy thông tin loyalty của bệnh nhân
    const loyaltyInfo =
      await this.loyaltyService.getLoyaltyInfoFromPatientProfile(
        prescription.patientProfile.id,
      );

    // Get selected services with their details và áp dụng giảm giá loyalty + promotion constraints
    const selectedServices: DiscountedServicePreview[] = prescription.services
      .filter((s) => selectedPrescriptionServiceIds.includes(s.id))
      .map((s) => {
        const originalPrice = s.service.price ?? 0;
        const {
          promotion: activePromotion,
          constraints,
          promotionDiscountAmount,
        } = this.getPromotionConstraints(s.service.promotion, originalPrice);

        const priceAfterPromotion = Math.max(
          0,
          originalPrice - promotionDiscountAmount,
        );

        let loyaltyDiscount: LoyaltyDiscountResult | null = null;
        let loyaltyBlocked = false;

        if (loyaltyInfo) {
          if (activePromotion?.allowLoyaltyDiscount === false) {
            loyaltyBlocked = true;
          } else {
            loyaltyDiscount = this.loyaltyService.applyLoyaltyDiscount(
              priceAfterPromotion,
              loyaltyInfo.totalPoints,
              constraints,
            );
          }
        }

        const loyaltyDiscountAmount = loyaltyDiscount?.discountAmount ?? 0;
        const finalPrice = Math.max(
          0,
          priceAfterPromotion - loyaltyDiscountAmount,
        );
        const totalDiscountAmount =
          promotionDiscountAmount + loyaltyDiscountAmount;
        const discountPercent =
          originalPrice > 0
            ? Math.round((totalDiscountAmount / originalPrice) * 100)
            : 0;

        const discountReason = this.buildDiscountReason({
          promotion: activePromotion,
          promotionDiscountAmount,
          loyaltyDiscount,
          loyaltyBlocked,
        });

        return {
          prescriptionServiceId: s.id,
          serviceId: s.serviceId,
          serviceCode: s.service.serviceCode,
          name: s.service.name,
          price: finalPrice,
          originalPrice,
          discountAmount: totalDiscountAmount,
          promotionDiscountAmount,
          loyaltyDiscountAmount,
          discountPercent,
          description: s.service.description,
          discountReason,
          promotionId: activePromotion?.id ?? null,
          promotionName: activePromotion?.name ?? null,
        };
      });

    const originalTotalAmount = selectedServices.reduce(
      (sum, service) => sum + service.originalPrice,
      0,
    );
    const totalAmount = selectedServices.reduce(
      (sum, service) => sum + service.price,
      0,
    );
    const totalDiscountAmount = originalTotalAmount - totalAmount;

    const discountReasonSummary = this.buildDiscountSummary(selectedServices);

    return {
      prescriptionDetails: prescription,
      selectedServices,
      totalAmount,
      originalTotalAmount,
      totalDiscountAmount,
      discountReasonSummary,
      patientName: prescription.patientProfile.name,
      loyaltyInfo: loyaltyInfo
        ? {
            totalPoints: loyaltyInfo.totalPoints,
            tierInfo: {
              tier: loyaltyInfo.tierInfo.tier,
              name: loyaltyInfo.tierInfo.name,
              discountPercent: loyaltyInfo.tierInfo.discountPercent,
              minPoints: loyaltyInfo.tierInfo.minPoints,
              nextTierPoints: loyaltyInfo.tierInfo.nextTierPoints,
            },
          }
        : undefined,
    };
  }

  async createPayment(dto: CreatePaymentDto): Promise<PaymentResult> {
    const preview = await this.createPaymentPreview(dto);
    const effectiveCashierId = await this.resolveCashierId(dto.cashierId);
    const prescription = preview.prescriptionDetails;
    const selectedServiceIds = preview.selectedServices.map((s) => s.serviceId);

    // Auto routing removed: skip checking available work sessions

    // Generate invoice code
    const invoiceCode = `INV-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)
      .toUpperCase()}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceCode,
        totalAmount: preview.totalAmount, // Giá sau giảm
        originalTotalAmount: preview.originalTotalAmount,
        totalDiscountAmount: preview.totalDiscountAmount,
        discountReason: preview.discountReasonSummary,
        paymentMethod: dto.paymentMethod,
        paymentStatus: 'PENDING',
        isPaid: false,
        patientProfileId: prescription.patientProfile.id,
        cashierId: effectiveCashierId,
        invoiceDetails: {
          create: preview.selectedServices.map((service) => ({
            serviceId: service.serviceId,
            price: service.price, // Giá sau giảm để thanh toán
            originalPrice: service.originalPrice,
            discountAmount: service.discountAmount,
            discountReason: service.discountReason,
            prescriptionId: prescription.id,
            prescriptionServiceId: service.prescriptionServiceId,
          })),
        },
      },
      include: {
        invoiceDetails: {
          include: { service: true },
        },
        patientProfile: true,
      },
    });

    let transaction: PaymentTransaction | null = null;
    if (dto.paymentMethod === PaymentMethod.TRANSFER) {
      if (!this.payOsService.isEnabled()) {
        throw new BadRequestException(
          'Hệ thống chưa cấu hình PayOS. Vui lòng liên hệ quản trị viên.',
        );
      }

      transaction = await this.createTransferTransaction({
        invoice,
        prescription,
        returnUrl: dto.returnUrl,
        cancelUrl: dto.cancelUrl,
      });
    }

    return {
      invoiceCode: invoice.invoiceCode,
      totalAmount: invoice.totalAmount,
      paymentStatus: invoice.paymentStatus,
      prescriptionId: prescription.id,
      patientProfileId: prescription.patientProfile.id,
      selectedServiceIds,
      paymentMethod: invoice.paymentMethod,
      transaction: this.mapTransactionSummary(transaction ?? undefined),
    };
  }

  private async createTransferTransaction(params: {
    invoice: Invoice & {
      invoiceDetails: Array<{
        serviceId: string;
        price: number;
        service: {
          name: string;
          serviceCode: string;
        };
      }>;
      patientProfile: {
        name: string;
        phone?: string | null;
      };
    };
    prescription: PrescriptionDetails;
    returnUrl?: string;
    cancelUrl?: string;
  }): Promise<PaymentTransaction> {
    const { invoice, prescription, returnUrl, cancelUrl } = params;

    const items = invoice.invoiceDetails.map((detail) => ({
      name: detail.service.name,
      quantity: 1,
      price: Math.round(detail.price),
    }));

    const description = this.buildPayOsDescription(invoice.invoiceCode);

    // Generate a stable, unique, numeric order code that PayOS echoes back in webhooks
    const generatedOrderCode = this.generateNumericOrderCode();

    const paymentLink = await this.payOsService.createPaymentLink({
      orderCode: generatedOrderCode,
      amount: Math.round(invoice.totalAmount),
      description,
      returnUrl,
      cancelUrl,
      buyerName: invoice.patientProfile.name,
      buyerPhone: invoice.patientProfile.phone ?? undefined,
      items,
      metadata: {
        invoiceId: invoice.id,
        invoiceCode: invoice.invoiceCode,
        prescriptionId: prescription.id,
      },
    });

    const status = this.mapPayOsStatus(paymentLink.status);
    const expiredAt = this.toDate(paymentLink.expiredAt ?? null);
    const paidAt =
      status === PaymentTransactionStatus.SUCCEEDED
        ? this.toDate(paymentLink.raw?.data?.paidAt ?? Date.now())
        : null;

    return this.prisma.paymentTransaction.create({
      data: {
        invoiceId: invoice.id,
        amount: paymentLink.amount ?? invoice.totalAmount,
        currency: paymentLink.currency ?? 'VND',
        status:
          status === PaymentTransactionStatus.SUCCEEDED
            ? PaymentTransactionStatus.SUCCEEDED
            : PaymentTransactionStatus.PENDING,
        providerTransactionId: paymentLink.transactionId,
        // Persist the exact orderCode we used or PayOS returned
        orderCode: paymentLink.orderCode ?? String(generatedOrderCode),
        paymentUrl: paymentLink.paymentUrl,
        qrCode: paymentLink.qrCode,
        expiredAt,
        paidAt,
        isVerified: false,
        lastWebhookPayload: paymentLink.raw ?? undefined,
        lastWebhookStatus: paymentLink.status ?? undefined,
        lastWebhookAt: new Date(),
      },
    });
  }

  /**
   * Create a safe integer order code that is unique enough for short windows and stays within JS safe integer range.
   * Example: 13-digit timestamp + 3 random digits => up to ~1.8e15 < 9e15 (Number.MAX_SAFE_INTEGER)
   */
  private generateNumericOrderCode(): number {
    const ts = Date.now();
    const rand = Math.floor(100 + Math.random() * 900); // 3 digits
    const code = Number(`${ts}${rand}`);
    return Number.isSafeInteger(code) ? code : ts;
  }

  private async completeInvoicePayment(
    invoice: Invoice & {
      originalTotalAmount?: number | null;
      totalDiscountAmount?: number | null;
      discountReason?: string | null;
      invoiceDetails: Array<{
        serviceId: string;
        price: number;
        originalPrice?: number | null;
        discountAmount?: number | null;
        discountReason?: string | null;
        prescriptionId: string | null;
        prescriptionServiceId: string | null;
        service: {
          serviceCode: string;
          name: string;
        };
      }>;
      patientProfile: {
        id: string;
        name: string;
        dateOfBirth: Date;
        gender: string;
      };
    },
    options: {
      cashierId?: string;
      transaction?: PaymentTransaction;
      source: 'MANUAL' | 'WEBHOOK' | 'SYSTEM';
    },
  ): Promise<PaymentResult & { routingAssignments: any[] }> {
    const cashierId = options.cashierId ?? invoice.cashierId;
    if (!cashierId) {
      throw new BadRequestException('Cashier identifier is required');
    }

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paymentStatus: 'PAID',
        isPaid: true,
        cashierId,
        amountPaid: invoice.totalAmount,
        changeAmount: 0,
      },
      include: {
        invoiceDetails: {
          include: { service: true },
        },
        patientProfile: true,
      },
    });

    const prescriptionId = updatedInvoice.invoiceDetails[0]?.prescriptionId;
    if (!prescriptionId) {
      throw new NotFoundException(
        'Prescription ID not found in invoice details',
      );
    }

    const prescription = await this.getPrescriptionById(prescriptionId);

    const selectedPrescriptionServiceIds = updatedInvoice.invoiceDetails
      .map((detail) => detail.prescriptionServiceId)
      .filter((id): id is string => id !== null);

    const allPrescriptionServiceIds = prescription.services.map(
      (service) => service.id,
    );

    const unselectedPrescriptionServiceIds = allPrescriptionServiceIds.filter(
      (id) => !selectedPrescriptionServiceIds.includes(id),
    );

    const pendingUnselectedIds: string[] = [];
    for (const prescriptionServiceId of unselectedPrescriptionServiceIds) {
      const service = prescription.services.find(
        (s) => s.id === prescriptionServiceId,
      );
      if (service && service.status === PrescriptionStatus.PENDING) {
        pendingUnselectedIds.push(prescriptionServiceId);
      }
    }

    if (pendingUnselectedIds.length > 0) {
      await this.prisma.prescriptionService.updateMany({
        where: {
          id: { in: pendingUnselectedIds },
        },
        data: { status: PrescriptionStatus.CANCELLED },
      });
    }

    // Mark each selected PrescriptionService as paid
    for (const prescriptionServiceId of selectedPrescriptionServiceIds) {
      // Get the PrescriptionService to find its serviceId
      const ps = prescription.services.find(
        (s) => s.id === prescriptionServiceId,
      );
      if (ps) {
        await this.prescriptionService.markServicePaid(
          prescription.id,
          ps.serviceId,
        );
      }
    }

    // Auto routing removed: no routing assignments
    const detailedRoutingAssignments: any[] = [];

    // Auto routing removed: skip publishing routing events

    // Get selectedServiceIds from invoice details for backward compatibility
    const selectedServiceIds = updatedInvoice.invoiceDetails.map(
      (detail) => detail.serviceId,
    );

    const result = {
      invoiceCode: updatedInvoice.invoiceCode,
      totalAmount: updatedInvoice.totalAmount,
      originalTotalAmount: updatedInvoice.originalTotalAmount ?? null,
      totalDiscountAmount: updatedInvoice.totalDiscountAmount ?? null,
      discountReason: updatedInvoice.discountReason ?? null,
      paymentStatus: 'PAID',
      prescriptionId: prescription.id,
      patientProfileId: updatedInvoice.patientProfileId,
      selectedServiceIds,
      paymentMethod: updatedInvoice.paymentMethod,
      transaction: this.mapTransactionSummary(options.transaction),
      routingAssignments: detailedRoutingAssignments,
      invoiceDetails: updatedInvoice.invoiceDetails.map((detail) => ({
        serviceId: detail.serviceId,
        serviceCode: detail.service.serviceCode,
        serviceName: detail.service.name,
        price: detail.price,
        originalPrice: detail.originalPrice ?? detail.price,
        discountAmount: detail.discountAmount ?? 0,
        discountReason:
          detail.discountReason ?? updatedInvoice.discountReason ?? null,
      })),
      patientInfo: {
        name: updatedInvoice.patientProfile.name,
        dateOfBirth: updatedInvoice.patientProfile.dateOfBirth,
        gender: updatedInvoice.patientProfile.gender,
      },
      prescriptionInfo: {
        prescriptionCode: prescription.prescriptionCode,
        status: prescription.status,
        doctorName: prescription.doctor?.auth.name,
      },
    };

    // Cộng điểm loyalty cho bệnh nhân sau khi thanh toán thành công
    try {
      const patientProfile = await this.prisma.patientProfile.findUnique({
        where: { id: updatedInvoice.patientProfileId },
        select: { patientId: true },
      });

      if (patientProfile?.patientId) {
        const baseAmountForPoints =
          updatedInvoice.originalTotalAmount ?? updatedInvoice.totalAmount;
        const pointsResult = await this.loyaltyService.addLoyaltyPoints(
          patientProfile.patientId,
          baseAmountForPoints,
        );

        this.logger.log(
          `Loyalty points added: ${pointsResult.pointsAdded} points. Total: ${pointsResult.totalPoints}. Tier: ${pointsResult.previousTier} -> ${pointsResult.newTier}`,
        );
      } else {
        this.logger.warn(
          `Patient profile ${updatedInvoice.patientProfileId} is not linked to a patient account. Skipping loyalty points.`,
        );
      }
    } catch (error) {
      // Không throw error để không ảnh hưởng đến quá trình thanh toán
      this.logger.error(
        `Failed to add loyalty points: ${(error as Error).message}`,
      );
    }

    // Gửi socket notification về thanh toán thành công trước khi trả kết quả
    // Chỉ emit socket event cho TRANSFER payments (webhook từ PayOS)
    // CASH payments đã được xử lý trực tiếp trong frontend và không cần socket notification
    if (updatedInvoice.paymentMethod === PaymentMethod.TRANSFER) {
    await this.notifyInvoicePaymentSuccess(updatedInvoice);
    }

    return result;
  }

  async confirmPayment(
    dto: ConfirmPaymentDto,
  ): Promise<PaymentResult & { routingAssignments: any[] }> {
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

    const effectiveCashierId = await this.resolveCashierId(dto.cashierId);

    let transactionRecord: PaymentTransaction | undefined;
    if (invoice.paymentMethod === PaymentMethod.TRANSFER) {
      const transactions = await this.prisma.paymentTransaction.findMany({
        where: {
          invoiceId: invoice.id,
          ...(dto.transactionId
            ? {
                OR: [
                  { providerTransactionId: dto.transactionId },
                  { id: dto.transactionId },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      const targetTransaction = transactions[0];
      if (!targetTransaction) {
        throw new BadRequestException(
          'Không tìm thấy giao dịch chuyển khoản để xác nhận.',
        );
      }

      transactionRecord = await this.prisma.paymentTransaction.update({
        where: { id: targetTransaction.id },
        data: {
          status: PaymentTransactionStatus.SUCCEEDED,
          paidAt: new Date(),
          isVerified: false,
          lastWebhookStatus: 'MANUAL_CONFIRM',
          lastWebhookAt: new Date(),
        },
      });
    }

    return this.completeInvoicePayment(invoice, {
      cashierId: effectiveCashierId,
      transaction: transactionRecord,
      source: 'MANUAL',
    });
  }

  async refreshPaymentLink(
    invoiceCode: string,
    options: { returnUrl?: string; cancelUrl?: string; requesterId?: string },
  ): Promise<PaymentResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { invoiceCode },
      include: {
        invoiceDetails: {
          include: { service: true },
        },
        patientProfile: true,
        paymentTransactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.isPaid) {
      throw new BadRequestException('Invoice has already been paid');
    }

    if (invoice.paymentMethod !== PaymentMethod.TRANSFER) {
      throw new BadRequestException(
        'Phiếu thu này không sử dụng phương thức chuyển khoản.',
      );
    }

    const prescriptionId = invoice.invoiceDetails[0]?.prescriptionId;
    if (!prescriptionId) {
      throw new NotFoundException(
        'Prescription ID not found in invoice details',
      );
    }

    const prescription = await this.getPrescriptionById(prescriptionId);

    const activeStatuses = new Set<PaymentTransactionStatus>([
      PaymentTransactionStatus.PENDING,
      PaymentTransactionStatus.PROCESSING,
    ]);

    const activeTransactions = invoice.paymentTransactions.filter((tx) =>
      activeStatuses.has(tx.status),
    );

    if (activeTransactions.length > 0) {
      await this.prisma.paymentTransaction.updateMany({
        where: { id: { in: activeTransactions.map((tx) => tx.id) } },
        data: {
          status: PaymentTransactionStatus.CANCELLED,
          lastWebhookStatus: 'MANUAL_REFRESH',
          lastWebhookAt: new Date(),
        },
      });
    }

    const newTransaction = await this.createTransferTransaction({
      invoice,
      prescription,
      returnUrl: options.returnUrl,
      cancelUrl: options.cancelUrl,
    });

    const selectedServiceIds = invoice.invoiceDetails.map(
      (detail) => detail.serviceId,
    );

    return {
      invoiceCode: invoice.invoiceCode,
      totalAmount: invoice.totalAmount,
      paymentStatus: invoice.paymentStatus,
      prescriptionId: prescription.id,
      patientProfileId: invoice.patientProfileId,
      selectedServiceIds,
      paymentMethod: invoice.paymentMethod,
      transaction: this.mapTransactionSummary(newTransaction),
    };
  }

  async handlePayOsWebhook(
    signature: string | undefined,
    payload: any,
  ): Promise<{
    success: boolean;
    data?: any;
    status?: PaymentTransactionStatus;
    invoiceCode?: string;
  }> {
    if (!this.payOsService.isEnabled()) {
      throw new BadRequestException('PayOS integration is not configured.');
    }

    this.logger.debug(
      `Webhook received. Signature present=${Boolean(signature)} payloadType=${typeof payload}`,
    );

    let parsedPayload: any = payload;
    if (typeof payload === 'string') {
      // Try JSON parse first
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        // Fallback: attempt to parse application/x-www-form-urlencoded body
        try {
          const params = new URLSearchParams(payload);
          const obj: Record<string, any> = {};
          params.forEach((value, key) => {
            obj[key] = value;
          });
          parsedPayload = Object.keys(obj).length > 0 ? obj : null;
        } catch {
          parsedPayload = null;
        }
        if (!parsedPayload) {
          this.logger.warn(
            'Webhook payload could not be parsed as JSON or form-encoded',
          );
        }
      }
    }

    // If payload is object but nested data is stringified JSON, parse it
    if (
      parsedPayload &&
      typeof parsedPayload === 'object' &&
      typeof parsedPayload.data === 'string'
    ) {
      try {
        parsedPayload.data = JSON.parse(parsedPayload.data);
        this.logger.debug('Parsed nested payload.data JSON string');
      } catch {
        // ignore if not JSON
      }
    }

    let effectiveSignature = signature;
    if (
      !effectiveSignature &&
      parsedPayload &&
      typeof parsedPayload.signature === 'string'
    ) {
      effectiveSignature = parsedPayload.signature;
      this.logger.debug('Using signature field from payload body');
    }

    if (
      !effectiveSignature &&
      parsedPayload &&
      parsedPayload.data &&
      typeof parsedPayload.data.signature === 'string'
    ) {
      effectiveSignature = parsedPayload.data.signature;
      this.logger.debug('Using signature field from payload.data');
    }

    if (!effectiveSignature) {
      try {
        const printable = parsedPayload ?? payload;
        this.logger.warn(
          `Webhook missing signature. Raw payload=${JSON.stringify(printable)}`,
        );
      } catch (error) {
        this.logger.warn(`Error stringifying payload: ${error}`);
        this.logger.warn(
          'Webhook missing signature. Payload could not be stringified',
        );
      }
      return {
        success: true,
        status: PaymentTransactionStatus.PENDING,
      };
    }

    const verified = await this.payOsService.verifyWebhook(
      effectiveSignature,
      parsedPayload ?? payload,
    );
    if (!verified) {
      throw new BadRequestException('Invalid PayOS signature');
    }

    const rawPayload =
      verified.raw ??
      parsedPayload ??
      (typeof payload === 'string'
        ? (() => {
            try {
              return JSON.parse(payload) as unknown;
            } catch {
              return undefined;
            }
          })()
        : payload);

    this.logger.debug(
      `Webhook verified. Keys=${Object.keys(rawPayload ?? {}).join(', ')}`,
    );

    const transactionId =
      (verified.transactionId && verified.transactionId !== 'unknown'
        ? verified.transactionId
        : undefined) ??
      rawPayload?.data?.transactionId ??
      rawPayload?.data?.paymentLinkId ??
      rawPayload?.transactionId;

    const orderCode =
      verified.orderCode ??
      rawPayload?.data?.orderCode ??
      rawPayload?.orderCode ??
      rawPayload?.paymentLinkId;

    this.logger.debug(
      `Resolved identifiers transactionId=${transactionId ?? 'N/A'} orderCode=${orderCode ?? 'N/A'} metadata.invoiceCode=${rawPayload?.data?.metadata?.invoiceCode ?? rawPayload?.metadata?.invoiceCode ?? 'N/A'}`,
    );

    if (!transactionId && !orderCode) {
      throw new BadRequestException(
        'Webhook payload missing transaction reference.',
      );
    }

    let transaction = await this.prisma.paymentTransaction.findFirst({
      where: transactionId
        ? { providerTransactionId: transactionId }
        : { orderCode: orderCode ? String(orderCode) : undefined },
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: {
          include: {
            invoiceDetails: {
              include: { service: true },
            },
            patientProfile: true,
          },
        },
      },
    });

    if (!transaction && orderCode) {
      this.logger.debug(
        `Primary lookup failed, retrying by orderCode=${orderCode}`,
      );
      transaction = await this.prisma.paymentTransaction.findFirst({
        where: { orderCode: String(orderCode) },
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: {
            include: {
              invoiceDetails: {
                include: { service: true },
              },
              patientProfile: true,
            },
          },
        },
      });
    }

    if (!transaction || !transaction.invoice) {
      this.logger.warn(
        `Primary lookup failed. Trying fallback by amount/time window. transactionId=${transactionId ?? 'N/A'} orderCode=${orderCode ?? 'N/A'}`,
      );

      const amount =
        verified.amount ??
        rawPayload?.data?.amount ??
        rawPayload?.data?.totalAmount ??
        undefined;

      // Fallback: find the most recent pending/processing transaction with the same amount, not yet paid, within last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const candidates = await this.prisma.paymentTransaction.findMany({
        where: {
          status: {
            in: [
              PaymentTransactionStatus.PENDING,
              PaymentTransactionStatus.PROCESSING,
            ],
          },
          ...(amount ? { amount: amount } : {}),
          invoice: { isPaid: false, createdAt: { gte: thirtyMinutesAgo } },
        },
        orderBy: { createdAt: 'desc' },
        take: 2,
        include: {
          invoice: {
            include: {
              invoiceDetails: { include: { service: true } },
              patientProfile: true,
            },
          },
        },
      });

      if (candidates.length === 1) {
        transaction = candidates[0];
        this.logger.warn(
          `Using fallback transaction id=${transaction.id} for webhook processing.`,
        );
      } else {
        this.logger.warn(
          `Webhook transaction not found. transactionId=${transactionId ?? 'N/A'} orderCode=${orderCode ?? 'N/A'} verifiedTransactionId=${verified.transactionId} verifiedOrderCode=${verified.orderCode}`,
        );
        return {
          success: true,
          status: PaymentTransactionStatus.PENDING,
        };
      }
    }

    const status = this.mapPayOsStatus(
      verified.status ??
        rawPayload?.data?.status ??
        rawPayload?.status ??
        rawPayload?.data?.code,
    );

    const updatedTransaction = await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status,
        providerTransactionId:
          transactionId ?? transaction.providerTransactionId,
        orderCode: orderCode ? String(orderCode) : transaction.orderCode,
        paymentUrl:
          verified.paymentUrl ??
          rawPayload?.checkoutUrl ??
          rawPayload?.data?.paymentUrl ??
          transaction.paymentUrl,
        qrCode:
          verified.qrCode ?? rawPayload?.data?.qrCode ?? transaction.qrCode,
        amount:
          verified.amount ??
          rawPayload?.data?.amount ??
          rawPayload?.data?.totalAmount ??
          transaction.amount,
        currency:
          verified.currency ??
          rawPayload?.data?.currency ??
          transaction.currency,
        expiredAt:
          this.toDate(
            verified.expiredAt ??
              rawPayload?.expiredAt ??
              rawPayload?.data?.expiredAt ??
              rawPayload?.data?.expireAt ??
              rawPayload?.data?.expiresAt,
          ) ?? transaction.expiredAt,
        paidAt:
          status === PaymentTransactionStatus.SUCCEEDED
            ? this.toDate(
                rawPayload?.paidAt ??
                  rawPayload?.data?.paidAt ??
                  rawPayload?.data?.completedAt ??
                  Date.now(),
              )
            : null,
        isVerified: true,
        lastWebhookPayload: rawPayload,
        lastWebhookStatus:
          verified.status ?? rawPayload?.data?.status ?? rawPayload?.data?.code,
        lastWebhookAt: new Date(),
      },
    });

    if (status === PaymentTransactionStatus.SUCCEEDED) {
      if (transaction.invoice.isPaid) {
        // Gửi socket notification ngay cả khi hóa đơn đã được thanh toán trước đó
        await this.notifyInvoicePaymentSuccess(transaction.invoice);
        return {
          success: true,
          status,
          invoiceCode: transaction.invoice.invoiceCode,
        };
      }

      const result = await this.completeInvoicePayment(transaction.invoice, {
        cashierId: transaction.invoice.cashierId,
        transaction: updatedTransaction,
        source: 'WEBHOOK',
      });

      return {
        success: true,
        data: result,
        status,
        invoiceCode: transaction.invoice.invoiceCode,
      };
    }

    return {
      success: true,
      status,
      invoiceCode: transaction.invoice.invoiceCode,
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

  private getPromotionConstraints(
    promotion: ServicePromotionSnapshot | null | undefined,
    originalPrice: number,
  ): {
    promotion: ServicePromotionSnapshot | null;
    constraints?: LoyaltyDiscountConstraints;
    promotionDiscountAmount: number;
  } {
    if (!promotion || !this.isPromotionCurrentlyActive(promotion)) {
      return {
        promotion: null,
        constraints: undefined,
        promotionDiscountAmount: 0,
      };
    }

    const constraints: LoyaltyDiscountConstraints = {
      allowLoyaltyDiscount: promotion.allowLoyaltyDiscount,
      maxDiscountPercent: promotion.maxDiscountPercent ?? undefined,
      maxDiscountAmount: promotion.maxDiscountAmount ?? undefined,
    };

    const { amount } = this.calculatePromotionDiscount(
      originalPrice,
      promotion,
    );

    return { promotion, constraints, promotionDiscountAmount: amount };
  }

  private isPromotionCurrentlyActive(
    promotion: ServicePromotionSnapshot,
  ): boolean {
    if (!promotion.isActive) {
      return false;
    }
    const now = new Date();
    if (promotion.startDate && promotion.startDate > now) {
      return false;
    }
    if (promotion.endDate && promotion.endDate < now) {
      return false;
    }
    return true;
  }

  private buildDiscountReason({
    promotion,
    promotionDiscountAmount,
    loyaltyDiscount,
    loyaltyBlocked,
  }: {
    promotion?: ServicePromotionSnapshot | null;
    promotionDiscountAmount: number;
    loyaltyDiscount: LoyaltyDiscountResult | null;
    loyaltyBlocked: boolean;
  }): string | null {
    const parts: string[] = [];

    if (promotion && promotionDiscountAmount > 0) {
      parts.push(`PROMOTION:${promotion.name ?? promotion.id}`);
    }

    if (loyaltyDiscount && loyaltyDiscount.discountAmount > 0) {
      const capLabels: string[] = [];
      if (loyaltyDiscount.wasPercentCapped) {
        capLabels.push('percent');
      }
      if (loyaltyDiscount.wasAmountCapped) {
        capLabels.push('amount');
      }
      const loyaltyPart = capLabels.length
        ? `LOYALTY_${loyaltyDiscount.tierInfo.tier}|CAP(${capLabels.join('+')})`
        : `LOYALTY_${loyaltyDiscount.tierInfo.tier}`;
      parts.push(loyaltyPart);
    } else if (loyaltyBlocked) {
      parts.push(
        promotion?.name
          ? `LOYALTY_BLOCKED_BY_PROMOTION:${promotion.name}`
          : 'LOYALTY_BLOCKED_BY_PROMOTION',
      );
    }

    return parts.length > 0 ? parts.join(' | ') : null;
  }

  private calculatePromotionDiscount(
    originalPrice: number,
    promotion: ServicePromotionSnapshot,
  ): { amount: number } {
    if (originalPrice <= 0) {
      return { amount: 0 };
    }

    const percent = promotion.maxDiscountPercent ?? 0;
    const amountFromPercent = percent > 0 ? (originalPrice * percent) / 100 : 0;

    let amount = amountFromPercent;
    if (
      promotion.maxDiscountAmount !== null &&
      promotion.maxDiscountAmount !== undefined
    ) {
      amount = Math.min(amount, promotion.maxDiscountAmount);
    }

    amount = Math.max(0, Math.min(amount, originalPrice));

    return { amount: Math.round(amount) };
  }

  private buildDiscountSummary(
    services: DiscountedServicePreview[],
  ): string | null {
    const reasons = services
      .filter(
        (service) =>
          (service.discountAmount ?? 0) > 0 && service.discountReason,
      )
      .map((service) => service.discountReason as string);

    if (reasons.length === 0) {
      return null;
    }

    return Array.from(new Set(reasons)).join(' || ');
  }

  private mapTransactionSummary(
    transaction?: PaymentTransaction | null,
  ): PaymentTransactionSummary | undefined {
    if (!transaction) return undefined;
    return {
      id: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      paymentUrl: transaction.paymentUrl,
      qrCode: transaction.qrCode,
      providerTransactionId: transaction.providerTransactionId,
      orderCode: transaction.orderCode,
      expiredAt: transaction.expiredAt,
      paidAt: transaction.paidAt,
      isVerified: transaction.isVerified,
    };
  }

  private toDate(value?: number | string | Date | null): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
      return value > 0 && value < 10_000_000_000
        ? new Date(value * 1000)
        : new Date(value);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private mapPayOsStatus(status?: string): PaymentTransactionStatus {
    const normalized = status?.toUpperCase();
    switch (normalized) {
      case 'PAID':
      case 'SUCCESS':
      case 'SUCCEEDED':
      case 'COMPLETED':
      case '00':
        return PaymentTransactionStatus.SUCCEEDED;
      case 'PROCESSING':
      case 'PROCESS':
      case 'INPROGRESS':
        return PaymentTransactionStatus.PROCESSING;
      case 'FAILED':
      case 'FAIL':
      case 'ERROR':
      case '201':
        return PaymentTransactionStatus.FAILED;
      case 'CANCELLED':
      case 'CANCELED':
      case 'VOIDED':
        return PaymentTransactionStatus.CANCELLED;
      case 'PENDING':
      default:
        return PaymentTransactionStatus.PENDING;
    }
  }

  private buildPayOsDescription(invoiceCode: string): string {
    const maxLength = 25;
    const prefix = 'TT ';
    const normalizedCode = invoiceCode?.trim() ?? '';
    const available = Math.max(maxLength - prefix.length, 0);
    const fallback = 'INVOICE';
    const codeSegment = (normalizedCode || fallback).slice(-available);
    const description = `${prefix}${codeSegment}`;
    return description.length <= maxLength
      ? description
      : description.slice(0, maxLength);
  }

  /**
   * Gửi thông báo socket khi thanh toán thành công đến cashier cụ thể
   */
  private async notifyInvoicePaymentSuccess(invoice: any): Promise<void> {
    try {
      const cashierId = invoice.cashierId;
      if (!cashierId) {
        this.logger.warn(
          `[INVOICE PAYMENT] ⚠️ No cashierId found for invoice ${invoice.invoiceCode}, skipping notification`,
        );
        return;
      }

      this.logger.debug(
        `[INVOICE PAYMENT] 🔍 Checking notification for invoice ${invoice.invoiceCode}`,
      );
      this.logger.debug(`[INVOICE PAYMENT] 💼 Invoice cashierId: ${cashierId}`);

      // Kiểm tra cashier có online không
      const isCashierOnline = this.webSocketService.isCashierOnline(cashierId);
      if (!isCashierOnline) {
        const allOnlineCashiers = this.webSocketService.getOnlineCashiers();
        this.logger.warn(
          `[INVOICE PAYMENT] ❌ Cashier ${cashierId} is not online, skipping notification for invoice ${invoice.invoiceCode}`,
        );
        this.logger.warn(
          `[INVOICE PAYMENT] 📋 Currently online cashiers: ${allOnlineCashiers.length > 0 ? allOnlineCashiers.join(', ') : 'NONE'}`,
        );
        return;
      }

      this.logger.debug(
        `[INVOICE PAYMENT] ✅ Cashier ${cashierId} is online, sending notification...`,
      );
      await this.webSocketService.notifyCashierInvoicePaymentSuccess(
        cashierId,
        invoice,
      );
      this.logger.debug(
        `[INVOICE PAYMENT] ✅ Sent invoice payment success notification to cashier ${cashierId} for invoice ${invoice.invoiceCode}`,
      );
    } catch (error) {
      this.logger.error(
        `[INVOICE PAYMENT] ❌ Failed to send invoice payment success notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Lấy thông tin chi tiết hóa đơn theo invoice ID
   */
  async getInvoiceById(invoiceId: string) {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: {
          id: invoiceId,
        },
        include: {
          patientProfile: {
            select: {
              id: true,
              name: true,
              phone: true,
              dateOfBirth: true,
              gender: true,
            },
          },
          cashier: {
            select: {
              id: true,
              auth: {
                select: {
                  name: true,
                },
              },
            },
          },
          invoiceDetails: {
            include: {
              service: {
                select: {
                  id: true,
                  serviceCode: true,
                  name: true,
                  price: true,
                  description: true,
                },
              },
              prescription: {
                select: {
                  id: true,
                  prescriptionCode: true,
                  note: true,
                  status: true,
                  doctor: {
                    select: {
                      id: true,
                      doctorCode: true,
                      auth: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          paymentTransactions: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              orderCode: true,
              paymentUrl: true,
              qrCode: true,
              expiredAt: true,
              paidAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      return {
        success: true,
        data: {
          id: invoice.id,
          invoiceCode: invoice.invoiceCode,
          totalAmount: invoice.totalAmount,
          amountPaid: invoice.amountPaid,
          changeAmount: invoice.changeAmount,
          paymentMethod: invoice.paymentMethod,
          paymentStatus: invoice.paymentStatus,
          isPaid: invoice.isPaid,
          createdAt: invoice.createdAt,
          patientProfile: invoice.patientProfile,
          cashier: invoice.cashier,
          invoiceDetails: invoice.invoiceDetails,
          paymentTransactions: invoice.paymentTransactions,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get invoice by ID ${invoiceId}: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve invoice details');
    }
  }
}
