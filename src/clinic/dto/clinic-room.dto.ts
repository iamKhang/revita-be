import { IsString, IsNotEmpty, IsOptional, IsUUID, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBoothInRoomDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];
}

export class UpdateBoothInRoomDto {
  @IsOptional()
  @IsUUID()
  id?: string; // ID của booth nếu đang cập nhật booth hiện có

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];
}

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
  @ValidateNested({ each: true })
  @Type(() => CreateBoothInRoomDto)
  booths?: CreateBoothInRoomDto[];
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
  @ValidateNested({ each: true })
  @Type(() => UpdateBoothInRoomDto)
  booths?: UpdateBoothInRoomDto[];
}

export class SaveCommonServicesDto {
  @IsArray()
  @IsString({ each: true })
  serviceIds!: string[];
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
    services?: Array<{
      id: string;
      serviceCode: string;
      name: string;
      price?: number;
    }>;
  }>;
}

export class ClinicRoomServiceAssignmentDto {
  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;
}
