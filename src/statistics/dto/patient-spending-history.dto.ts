import { IsOptional, IsString } from 'class-validator';

export class PatientSpendingQueryDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  patientProfileId?: string;
}

export class PatientProfileSpendingDto {
  patientProfileId: string;
  profileCode: string;
  profileName: string;
  relationship: string | null;
  totalSpent: number;
  totalPaid: number;
  accountsReceivable: number;
  invoiceCount: number;
  appointmentCount: number;
  lastVisit: string | null;
}

export class PatientFamilySpendingDto {
  patientId: string;
  patientCode: string;
  patientName: string | null;
  totalSpent: number;
  totalPaid: number;
  accountsReceivable: number;
  totalInvoices: number;
  totalAppointments: number;
  profileCount: number;
  profiles: PatientProfileSpendingDto[];
}

export class PatientSpendingHistoryResponseDto {
  familySpending?: PatientFamilySpendingDto;
  profileSpending?: PatientProfileSpendingDto;
  period: {
    startDate: string;
    endDate: string;
  };
}
