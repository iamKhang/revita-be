import { 
  Body, 
  Controller, 
  Get, 
  Param, 
  Post, 
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InvoicePaymentService } from './invoice-payment.service';
import { ScanPrescriptionDto } from './dto/scan-prescription.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { JwtAuthGuard } from '../login/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { Role } from '../rbac/roles.enum';

@Controller('invoice-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicePaymentController {
  constructor(
    private readonly invoicePaymentService: InvoicePaymentService,
  ) {}

  @Post('scan')
  @Roles(Role.CASHIER)
  async scanPrescription(@Body() dto: ScanPrescriptionDto) {
    return this.invoicePaymentService.scanPrescription(dto);
  }

  @Post('preview')
  @Roles(Role.CASHIER)
  async createPaymentPreview(@Body() dto: CreatePaymentDto) {
    return this.invoicePaymentService.createPaymentPreview(dto);
  }

  @Post('create')
  @Roles(Role.CASHIER)
  async createPayment(
    @Body() dto: CreatePaymentDto,
    @Request() req: any,
  ) {
    // Extract cashier ID from JWT token
    const cashierId = req.user?.cashier?.id;
    if (!cashierId) {
      throw new Error('Cashier ID not found in token');
    }

    return this.invoicePaymentService.createPayment({
      ...dto,
      cashierId,
    });
  }

  @Post('confirm')
  @Roles(Role.CASHIER)
  async confirmPayment(
    @Body() dto: ConfirmPaymentDto,
    @Request() req: any,
  ) {
    // Extract cashier ID from JWT token
    const cashierId = req.user?.cashier?.id;
    if (!cashierId) {
      throw new Error('Cashier ID not found in token');
    }

    return this.invoicePaymentService.confirmPayment({
      ...dto,
      cashierId,
    });
  }

  @Get('history/:patientProfileId')
  @Roles(Role.CASHIER, Role.PATIENT)
  async getPaymentHistory(@Param('patientProfileId') patientProfileId: string) {
    return this.invoicePaymentService.getPaymentHistory(patientProfileId);
  }

  @Get('status/:prescriptionCode')
  @Roles(Role.CASHIER, Role.PATIENT, Role.DOCTOR)
  async getPrescriptionStatus(@Param('prescriptionCode') prescriptionCode: string) {
    return this.invoicePaymentService.getPrescriptionStatus(prescriptionCode);
  }

  @Get('invoice/:invoiceCode')
  @Roles(Role.CASHIER, Role.PATIENT)
  async getInvoiceDetails(@Param('invoiceCode') invoiceCode: string) {
    // This would be implemented to get detailed invoice information
    // For now, return a placeholder
    return { message: 'Invoice details endpoint - to be implemented' };
  }
}
