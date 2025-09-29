import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { createHmac } from 'crypto';

export interface PayOsCreatePaymentPayload {
  orderCode: string;
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

export interface PayOsWebhookPayload {
  code: string;
  desc: string;
  data?: any;
}

@Injectable()
export class PayOsService {
  private readonly logger = new Logger(PayOsService.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly apiKey: string;
  private readonly checksumKey: string;
  private readonly returnUrl?: string;
  private readonly cancelUrl?: string;
  private readonly webhookSecret?: string;
  private readonly createPaymentPath: string;

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
    this.webhookSecret =
      this.configService.get<string>('PAYOS_WEBHOOK_SECRET')?.trim() ?? undefined;
    this.createPaymentPath =
      this.configService.get<string>('PAYOS_CREATE_PAYMENT_PATH')?.trim() ??
      '/v2/payments';

    if (!this.clientId || !this.apiKey || !this.checksumKey) {
      this.logger.warn(
        'PayOS credentials are not fully configured. Transfer payments will be disabled.',
      );
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'x-client-id': this.clientId,
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  isEnabled(): boolean {
    return Boolean(this.clientId && this.apiKey && this.checksumKey);
  }

  async createPaymentLink(
    payload: PayOsCreatePaymentPayload,
  ): Promise<PayOsPaymentLink> {
    if (!this.isEnabled()) {
      throw new Error('PayOS credentials are not configured.');
    }

    const body = {
      ...payload,
      returnUrl: payload.returnUrl ?? this.returnUrl,
      cancelUrl: payload.cancelUrl ?? this.cancelUrl,
    };

    const signature = this.signData(body);
    const requestBody = { ...body, signature };

    try {
      const response = await this.client.post(this.createPaymentPath, requestBody);
      return this.mapPaymentLinkResponse(response.data);
    } catch (error) {
      this.logger.error(
        `Failed to create PayOS payment link for orderCode=${payload.orderCode}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  verifyWebhookSignature(
    signature: string | undefined,
    payload: any,
  ): boolean {
    const secret = this.webhookSecret || this.checksumKey;
    if (!secret || !signature) {
      return false;
    }
    const rawPayload =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    const computed = createHmac('sha256', secret).update(rawPayload).digest('hex');
    return computed === signature;
  }

  extractWebhookData(payload: PayOsWebhookPayload): PayOsPaymentLink | null {
    if (!payload?.data) {
      return null;
    }
    return this.mapPaymentLinkResponse(payload.data);
  }

  private mapPaymentLinkResponse(data: any): PayOsPaymentLink {
    if (!data) {
      return {
        transactionId: 'unknown',
        amount: 0,
        raw: data,
      };
    }

    const payload = data?.data ?? data;

    return {
      transactionId:
        payload?.id ?? payload?.transactionId ?? payload?.transaction_id ?? 'unknown',
      orderCode:
        payload?.orderCode ?? payload?.order_code ?? data?.orderCode ?? data?.order_code,
      amount: payload?.amount ?? payload?.totalAmount ?? 0,
      currency: payload?.currency ?? data?.currency ?? 'VND',
      status: payload?.status ?? data?.status,
      paymentUrl:
        payload?.checkoutUrl ??
        payload?.paymentUrl ??
        payload?.shortLink ??
        data?.checkoutUrl ??
        data?.paymentUrl,
      qrCode: payload?.qrCode ?? payload?.qrCodeUrl ?? data?.qrCode,
      expiredAt:
        payload?.expiredAt ??
        payload?.expireAt ??
        payload?.expiresAt ??
        data?.expiredAt,
      raw: data,
    };
  }

  private signData(data: Record<string, any>): string {
    const canonical = JSON.stringify(this.sortObjectKeys(data));
    return createHmac('sha256', this.checksumKey).update(canonical).digest('hex');
  }

  private sortObjectKeys(input: Record<string, any>): Record<string, any> {
    return Object.keys(input)
      .sort()
      .reduce((acc: Record<string, any>, key: string) => {
        const value = input[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          acc[key] = this.sortObjectKeys(value as Record<string, any>);
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});
  }
}
