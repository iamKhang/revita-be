import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkSessionDto } from './create-work-session.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { WorkSessionStatus } from '@prisma/client';

export class UpdateWorkSessionDto extends PartialType(CreateWorkSessionDto) {
  @IsOptional()
  @IsEnum(WorkSessionStatus)
  status?: WorkSessionStatus;
}

