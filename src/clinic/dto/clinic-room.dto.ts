import { IsString, IsNotEmpty, IsOptional, IsUUID, IsArray } from 'class-validator';

export class CreateClinicRoomDto {
  @IsString()
  @IsNotEmpty()
  roomName!: string;

  @IsUUID()
  @IsNotEmpty()
  specialtyId!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];
}

export class UpdateClinicRoomDto {
  @IsOptional()
  @IsString()
  roomName?: string;

  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];
}

export class ClinicRoomResponseDto {
  id!: string;
  roomCode!: string;
  roomName!: string;
  specialtyId!: string;
  specialty?: {
    id: string;
    name: string;
    specialtyCode: string;
  };
  description?: string;
  address?: string;
  createdAt!: Date;
  updatedAt!: Date;
  services?: Array<{
    id: string;
    serviceCode: string;
    name: string;
    price?: number;
  }>;
  booths?: Array<{
    id: string;
    boothCode: string;
    name: string;
    isActive: boolean;
  }>;
}
