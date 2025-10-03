import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InvoicePaymentService } from './invoice-payment.service';
import { ScanPrescriptionDto } from './dto/scan-prescription.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { RefreshPaymentDto } from './dto/refresh-payment.dto';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';
import { Public } from '../rbac/public.decorator';

@Controller('invoice-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicePaymentController {
  constructor(private readonly invoicePaymentService: InvoicePaymentService) {}

  @Post('scan')
  @Roles(Role.CASHIER)
  async scanPrescription(@Body() dto: ScanPrescriptionDto) {
    return this.invoicePaymentService.scanPrescription(dto);
  }

  @Post('preview')
  @Roles(Role.CASHIER, Role.RECEPTIONIST)
  async createPaymentPreview(@Body() dto: CreatePaymentDto) {
    return this.invoicePaymentService.createPaymentPreview(dto);
  }

  @Post('create')
  @Roles(Role.CASHIER)
  async createPayment(@Body() dto: CreatePaymentDto, @Request() req: any) {
    // Prefer cashier id from JWT relation; fallback to body; final fallback for testing
    const cashierId =
      req.user?.cashier?.id || dto.cashierId || req.user?.id || 'system';
    return this.invoicePaymentService.createPayment({
      ...dto,
      cashierId,
    });
  }

  @Post('confirm')
  @Roles(Role.CASHIER)
  async confirmPayment(@Body() dto: ConfirmPaymentDto, @Request() req: any) {
    // Prefer cashier id from JWT relation; fallback to body; final fallback for testing
    const cashierId =
      req.user?.cashier?.id ||
      (dto as any).cashierId ||
      req.user?.id ||
      'system';
    return this.invoicePaymentService.confirmPayment({
      ...dto,
      cashierId,
    });
  }

  @Post('invoice/:invoiceCode/refresh')
  @Roles(Role.CASHIER, Role.PATIENT, Role.RECEPTIONIST)
  async refreshPayment(
    @Param('invoiceCode') invoiceCode: string,
    @Body() dto: RefreshPaymentDto,
    @Request() req: any,
  ) {
    return this.invoicePaymentService.refreshPaymentLink(invoiceCode, {
      ...dto,
      requesterId: req.user?.id,
    });
  }

  @Post('payos/webhook')
  @Public()
  async handlePayOsWebhook(
    @Body() payload: any,
    @Headers('x-payos-signature') payosSignature?: string,
    @Headers('x-signature') genericSignature?: string,
  ) {
    const signature = payosSignature || genericSignature;
    return this.invoicePaymentService.handlePayOsWebhook(signature, payload);
  }

  @Get('history/:patientProfileId')
  @Roles(Role.CASHIER, Role.PATIENT)
  async getPaymentHistory(@Param('patientProfileId') patientProfileId: string) {
    return this.invoicePaymentService.getPaymentHistory(patientProfileId);
  }

  @Get('status/:prescriptionCode')
  @Roles(Role.CASHIER, Role.PATIENT, Role.DOCTOR)
  async getPrescriptionStatus(
    @Param('prescriptionCode') prescriptionCode: string,
  ) {
    return this.invoicePaymentService.getPrescriptionStatus(prescriptionCode);
  }

  @Get('invoice/:invoiceCode')
  @Roles(Role.CASHIER, Role.PATIENT)
  async getInvoiceDetails(@Param('invoiceCode') invoiceCode: string) {
    // This would be implemented to get detailed invoice information
    // For now, return a placeholder
    return { message: 'Invoice details endpoint - to be implemented' };
  }

  @Get('invoice-by-id/:invoiceId')
  @Roles(Role.CASHIER, Role.PATIENT, Role.RECEPTIONIST)
  async getInvoiceById(@Param('invoiceId') invoiceId: string) {
    return this.invoicePaymentService.getInvoiceById(invoiceId);
  }
}
