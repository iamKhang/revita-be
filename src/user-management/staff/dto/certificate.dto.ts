import { CertificateType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';

export class CertificateDto {
  @IsOptional()
  @IsString()
  code?: string | null;

  @IsString()
  title!: string;

  @IsEnum(CertificateType)
  type!: CertificateType;

  @IsOptional()
  @IsString()
  issuedBy?: string | null;

  @IsOptional()
  @IsDateString()
  issuedAt?: Date | string | null;

  @IsOptional()
  @IsDateString()
  expiryAt?: Date | string | null;

  @IsOptional()
  @IsString()
  file?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;
}
