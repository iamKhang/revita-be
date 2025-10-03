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
          include: { service: true },
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
    const selectedServiceIds = preview.selectedServices.map((s) => s.serviceId);

    // Check if there are available work sessions for the requested services
    const currentTime = new Date();
    const availableAssignments = await this.routingService.assignPatientToRooms(
      {
        patientProfileId: prescription.patientProfile.id,
        serviceIds: selectedServiceIds,
        requestedTime: currentTime,
      },
    );

    if (availableAssignments.length === 0) {
      throw new BadRequestException(
        'Hiện tại chưa có nhân sự để phục vụ cho các dịch vụ đã chọn. Vui lòng thử lại sau hoặc liên hệ quầy tiếp tân để được hỗ trợ.',
      );
    }

    // Generate invoice code
    const invoiceCode = `INV-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)
      .toUpperCase()}`;

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

    const paymentLink = await this.payOsService.createPaymentLink({
      orderCode: invoice.invoiceCode,
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
        status: status === PaymentTransactionStatus.SUCCEEDED
          ? PaymentTransactionStatus.SUCCEEDED
          : PaymentTransactionStatus.PENDING,
        providerTransactionId: paymentLink.transactionId,
        orderCode: paymentLink.orderCode ?? invoice.invoiceCode,
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

  private async completeInvoicePayment(
    invoice: Invoice & {
      invoiceDetails: Array<{
        serviceId: string;
        price: number;
        prescriptionId: string | null;
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
      throw new NotFoundException('Prescription ID not found in invoice details');
    }

    const prescription = await this.getPrescriptionById(prescriptionId);

    const selectedServiceIds = updatedInvoice.invoiceDetails.map(
      (detail) => detail.serviceId,
    );

    const allPrescriptionServiceIds = prescription.services.map(
      (service) => service.serviceId,
    );

    const unselectedServiceIds = allPrescriptionServiceIds.filter(
      (id) => !selectedServiceIds.includes(id),
    );

    const pendingUnselectedIds: string[] = [];
    for (const serviceId of unselectedServiceIds) {
      const service = prescription.services.find((s) => s.serviceId === serviceId);
      if (service && service.status === PrescriptionStatus.PENDING) {
        pendingUnselectedIds.push(serviceId);
      }
    }

    if (pendingUnselectedIds.length > 0) {
      await this.prisma.prescriptionService.updateMany({
        where: {
          prescriptionId,
          serviceId: { in: pendingUnselectedIds },
        },
        data: { status: PrescriptionStatus.CANCELLED },
      });
    }

    for (const serviceId of selectedServiceIds) {
      await this.prescriptionService.markServicePaid(
        prescription.id,
        serviceId,
      );
    }

    let routingAssignments: any[] = [];
    try {
      const routingResult = await this.routingService.assignPatientToRooms({
        patientProfileId: updatedInvoice.patientProfileId,
        serviceIds: selectedServiceIds,
        requestedTime: new Date(),
      });
      routingAssignments = routingResult || [];
    } catch (error) {
      console.warn('Routing failed:', error);
    }

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

    const streamKey = process.env.REDIS_STREAM_ASSIGNMENTS || 'clinic:assignments';
    try {
      for (const assignment of detailedRoutingAssignments) {
        await this.redisStream.publishEvent(streamKey, {
          type: 'PATIENT_ASSIGNED',
          patientProfileId: updatedInvoice.patientProfileId,
          patientName: updatedInvoice.patientProfile.name,
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
      invoiceCode: updatedInvoice.invoiceCode,
      totalAmount: updatedInvoice.totalAmount,
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

    // Gửi socket notification về thanh toán thành công
    await this.notifyInvoicePaymentSuccess(updatedInvoice);
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
  ): Promise<{ success: boolean; data?: any; status?: PaymentTransactionStatus; invoiceCode?: string }> {
    if (!this.payOsService.isEnabled()) {
      throw new BadRequestException('PayOS integration is not configured.');
    }

    this.logger.debug(
      `Webhook received. Signature present=${Boolean(signature)} payloadType=${typeof payload}`,
    );

    let parsedPayload: any = payload;
    if (typeof payload === 'string') {
      try {
        parsedPayload = JSON.parse(payload);
      } catch (error) {
        this.logger.warn('Webhook payload could not be parsed as JSON for signature extraction');
        parsedPayload = null;
      }
    }

    let effectiveSignature = signature;
    if (!effectiveSignature && parsedPayload && typeof parsedPayload.signature === 'string') {
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
        this.logger.warn('Webhook missing signature. Payload could not be stringified');
      }
      return {
        success: true,
        status: PaymentTransactionStatus.PENDING,
      };
    }

    const verified = await this.payOsService.verifyWebhook(
      effectiveSignature,
      payload,
    );
    if (!verified) {
      throw new BadRequestException('Invalid PayOS signature');
    }

    const rawPayload =
      verified.raw ?? (typeof payload === 'string' ? JSON.parse(payload) : payload);

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
        `Webhook transaction not found. transactionId=${transactionId ?? 'N/A'} orderCode=${orderCode ?? 'N/A'} verifiedTransactionId=${verified.transactionId} verifiedOrderCode=${verified.orderCode}`,
      );
      throw new NotFoundException('Matching transaction not found');
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
        providerTransactionId: transactionId ?? transaction.providerTransactionId,
        orderCode: orderCode ? String(orderCode) : transaction.orderCode,
        paymentUrl:
          verified.paymentUrl ??
          rawPayload?.checkoutUrl ??
          rawPayload?.data?.paymentUrl ??
          transaction.paymentUrl,
        qrCode: verified.qrCode ?? rawPayload?.data?.qrCode ?? transaction.qrCode,
        amount:
          verified.amount ??
          rawPayload?.data?.amount ??
          rawPayload?.data?.totalAmount ??
          transaction.amount,
        currency: verified.currency ?? rawPayload?.data?.currency ?? transaction.currency,
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
      return value > 0 && value < 10_000_000_000 ? new Date(value * 1000) : new Date(value);
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
        this.logger.warn(`No cashierId found for invoice ${invoice.invoiceCode}, skipping notification`);
        return;
      }

      // Kiểm tra cashier có online không
      const isCashierOnline = this.webSocketService.isCashierOnline(cashierId);
      if (!isCashierOnline) {
        this.logger.debug(`Cashier ${cashierId} is not online, skipping notification for invoice ${invoice.invoiceCode}`);
        return;
      }

      await this.webSocketService.notifyCashierInvoicePaymentSuccess(cashierId, invoice);
      this.logger.debug(`Sent invoice payment success notification to cashier ${cashierId} for invoice: ${invoice.invoiceCode}`);
    } catch (error) {
      this.logger.error(`Failed to send invoice payment success notification: ${error.message}`, error.stack);
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
      this.logger.error(`Failed to get invoice by ID ${invoiceId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve invoice details');
    }
  }
}
