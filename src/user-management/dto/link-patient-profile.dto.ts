import { IsUUID, IsNotEmpty } from 'class-validator';

export class LinkPatientProfileDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;
}
