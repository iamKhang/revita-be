import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ScanInvoiceDto {
  @IsString()
  @IsNotEmpty()
  invoiceId: string;

  @IsString()
  @IsOptional()
  qrCode?: string;

  @IsString()
  @IsOptional()
  scannedBy?: string; // ID của người quét (receptionist)

  @IsString()
  @IsOptional()
  deviceId?: string; // ID của thiết bị quét (Electron app)
}
