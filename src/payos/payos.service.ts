import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS, APIError, InvalidSignatureError } from '@payos/node';

export interface PayOsCreatePaymentPayload {
  orderCode: string | number;
  amount: number;
  description: string;
  returnUrl?: string;
  cancelUrl?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  expiredAt?: number;
  items?: Array<{ name: string; quantity: number; price: number }>;
  metadata?: Record<string, any>;
}

export interface PayOsPaymentLink {
  transactionId: string;
  orderCode?: string;
  amount: number;
  currency?: string;
  status?: string;
  paymentUrl?: string;
  qrCode?: string;
  expiredAt?: number;
  raw: any;
}

@Injectable()
export class PayOsService {
  private readonly logger = new Logger(PayOsService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly apiKey: string;
  private readonly checksumKey: string;
  private readonly returnUrl?: string;
  private readonly cancelUrl?: string;
  private readonly payosClient?: PayOS;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('PAYOS_BASE_URL')?.trim() ??
      'https://api.payos.vn';
    this.clientId = this.configService.get<string>('PAYOS_CLIENT_ID')?.trim() ?? '';
    this.apiKey = this.configService.get<string>('PAYOS_API_KEY')?.trim() ?? '';
    this.checksumKey =
      this.configService.get<string>('PAYOS_CHECKSUM_KEY')?.trim() ?? '';
    this.returnUrl = this.configService.get<string>('PAYOS_RETURN_URL')?.trim();
    this.cancelUrl = this.configService.get<string>('PAYOS_CANCEL_URL')?.trim();

    if (!this.clientId || !this.apiKey || !this.checksumKey) {
      this.logger.warn(
        'PayOS credentials are not fully configured. Transfer payments will be disabled.',
      );
      return;
    }

    this.payosClient = new PayOS({
      clientId: this.clientId,
      apiKey: this.apiKey,
      checksumKey: this.checksumKey,
      baseURL: this.baseUrl,
    });
  }

  isEnabled(): boolean {
    return Boolean(this.payosClient);
  }

  async createPaymentLink(
    payload: PayOsCreatePaymentPayload,
  ): Promise<PayOsPaymentLink> {
    if (!this.payosClient) {
      throw new Error('PayOS credentials are not configured.');
    }

    const normalizedOrderCode = this.normalizeOrderCode(payload.orderCode);

    try {
      const requestBody: Record<string, any> = {
        orderCode: normalizedOrderCode as any,
        amount: payload.amount,
        description: payload.description,
        items: payload.items,
        buyerName: payload.buyerName,
        buyerEmail: payload.buyerEmail,
        buyerPhone: payload.buyerPhone,
        expiredAt: payload.expiredAt,
      };

      const returnUrl = payload.returnUrl ?? this.returnUrl;
      const cancelUrl = payload.cancelUrl ?? this.cancelUrl;

      if (returnUrl) {
        requestBody.returnUrl = returnUrl;
      }

      if (cancelUrl) {
        requestBody.cancelUrl = cancelUrl;
      }

      const response = await this.payosClient.paymentRequests.create(
        requestBody as any,
      );

      return this.mapPaymentLinkResponse(response, {
        fallbackOrderCode: normalizedOrderCode,
        raw: response,
      });
    } catch (error) {
      if (error instanceof APIError) {
        this.logger.error(
          `PayOS trả về lỗi code=${error.code ?? error.status} desc=${error.desc ?? error.message}`,
        );
        throw new Error(
          `PayOS từ chối yêu cầu: ${error.desc ?? error.message ?? 'Lỗi không xác định'}`,
        );
      }

      this.logger.error(
        `Failed to create PayOS payment link for orderCode=${payload.orderCode}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async verifyWebhook(
    signature: string | undefined,
    payload: any,
  ): Promise<PayOsPaymentLink | null> {
    if (!this.payosClient || !signature) {
      return null;
    }

    const rawPayload =
      typeof payload === 'string' ? JSON.parse(payload) : payload ?? {};

    try {
      const verified = await this.payosClient.webhooks.verify({
        ...rawPayload,
        signature,
      });

      return this.mapPaymentLinkResponse(verified, {
        fallbackOrderCode: verified?.orderCode,
        raw: rawPayload,
      });
    } catch (error) {
      if (error instanceof InvalidSignatureError) {
        this.logger.warn('PayOS webhook signature không hợp lệ.');
        return null;
      }

      if (error instanceof APIError) {
        this.logger.error(
          `PayOS webhook verify lỗi code=${error.code ?? error.status} desc=${error.desc ?? error.message}`,
        );
      }

      throw error;
    }
  }

  private mapPaymentLinkResponse(
    data: any,
    options?: { fallbackOrderCode?: string | number; raw?: any },
  ): PayOsPaymentLink {
    if (!data) {
      return {
        transactionId: 'unknown',
        amount: 0,
        raw: options?.raw ?? data,
      };
    }

    const raw = options?.raw ?? data;
    const payload = data?.data ?? data;
    const orderCodeValue =
      options?.fallbackOrderCode ??
      payload?.orderCode ??
      payload?.order_code ??
      raw?.orderCode ??
      raw?.order_code ??
      raw?.data?.orderCode ??
      raw?.data?.order_code;

    return {
      transactionId:
        payload?.paymentLinkId ??
        payload?.id ??
        payload?.transactionId ??
        payload?.transaction_id ??
        raw?.paymentLinkId ??
        raw?.data?.paymentLinkId ??
        'unknown',
      orderCode:
        orderCodeValue !== undefined ? String(orderCodeValue) : undefined,
      amount:
        payload?.amount ??
        payload?.totalAmount ??
        raw?.amount ??
        raw?.data?.amount ??
        0,
      currency:
        payload?.currency ??
        raw?.currency ??
        raw?.data?.currency ??
        'VND',
      status:
        payload?.status ??
        raw?.status ??
        raw?.data?.status ??
        undefined,
      paymentUrl:
        payload?.checkoutUrl ??
        payload?.paymentUrl ??
        payload?.shortLink ??
        raw?.checkoutUrl ??
        raw?.paymentUrl,
      qrCode:
        payload?.qrCode ??
        payload?.qrCodeUrl ??
        raw?.qrCode ??
        raw?.data?.qrCode,
      expiredAt:
        payload?.expiredAt ??
        payload?.expireAt ??
        payload?.expiresAt ??
        raw?.expiredAt ??
        raw?.data?.expiredAt,
      raw,
    };
  }

  private normalizeOrderCode(orderCode: string | number): number | string {
    if (typeof orderCode === 'number' && Number.isSafeInteger(orderCode)) {
      return orderCode;
    }

    if (!orderCode) {
      return Date.now();
    }

    const digitsOnly = String(orderCode).replace(/\D/g, '');
    if (digitsOnly.length === 0) {
      return Date.now();
    }

    const numeric = Number(digitsOnly);
    if (!Number.isSafeInteger(numeric)) {
      this.logger.warn(
        `OrderCode ${orderCode} vượt quá giới hạn số an toàn. Dùng timestamp thay thế.`,
      );
      return Date.now();
    }

    return numeric;
  }
}
