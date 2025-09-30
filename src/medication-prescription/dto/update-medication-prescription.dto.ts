import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MedicationPrescriptionStatus } from '@prisma/client';

export class UpdateMedicationPrescriptionDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsEnum(MedicationPrescriptionStatus as unknown as object)
  status?: MedicationPrescriptionStatus;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => UpdateMedicationPrescriptionItemDto)
  items?: UpdateMedicationPrescriptionItemDto[];
}

export class UpdateMedicationPrescriptionItemDto {
  @IsOptional()
  @IsString()
  drugId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  ndc?: string;

  @IsOptional()
  @IsString()
  strength?: string;

  @IsOptional()
  @IsString()
  dosageForm?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsNumber()
  dose?: number;

  @IsOptional()
  @IsString()
  doseUnit?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  quantityUnit?: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}
