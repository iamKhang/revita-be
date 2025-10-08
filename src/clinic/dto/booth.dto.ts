import { IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean, IsArray } from 'class-validator';

export class CreateBoothDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUUID()
  @IsNotEmpty()
  roomId!: string;

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

export class UpdateBoothDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

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

export class BoothResponseDto {
  id!: string;
  boothCode!: string;
  name!: string;
  roomId!: string;
  room?: {
    id: string;
    roomCode: string;
    roomName: string;
    specialty: {
      id: string;
      name: string;
      specialtyCode: string;
    };
  };
  description?: string;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
  services?: Array<{
    id: string;
    serviceCode: string;
    name: string;
    price?: number;
  }>;
}

export class BoothServiceAssignmentDto {
  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;
}
