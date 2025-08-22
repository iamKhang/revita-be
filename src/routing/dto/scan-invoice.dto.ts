import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ScanInvoiceDto {
  @IsString()
  @IsOptional()
  scannedBy?: string; // ID của người quét (receptionist)

  @IsString()
  @IsOptional()
  deviceId?: string; // ID của thiết bị quét (Electron app)

  @IsString()
  @IsNotEmpty()
  qrCode: string; // Chỉ cần QR code
  invoiceId: any;
}
