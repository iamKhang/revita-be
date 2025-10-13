import { PartialType } from '@nestjs/mapped-types';
import { CreateDoctorRatingDto } from './create-doctor-rating.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateDoctorRatingDto extends PartialType(CreateDoctorRatingDto) {
  @IsOptional()
  @IsString()
  comment?: string;
}
