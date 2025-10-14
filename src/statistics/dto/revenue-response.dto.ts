export class RevenueOverviewDto {
  totalRevenue: number; // Tổng doanh thu
  paidRevenue: number; // Đã thanh toán
  accountsReceivable: number; // Phải thu (AR)
  paidPercent: number;
  arPercent: number;
}

export class RevenueByTimeDto {
  date: string; // ISO date string
  totalRevenue: number;
  paidRevenue: number;
  accountsReceivable: number;
  invoiceCount: number;
}

export class RevenueBySpecialtyDto {
  specialtyId: string;
  specialtyName: string;
  specialtyCode: string;
  totalRevenue: number;
  paidRevenue: number;
  appointmentCount: number;
  revenuePercent: number;
}

export class RevenueByServiceDto {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  totalRevenue: number;
  paidRevenue: number;
  usageCount: number;
  revenuePercent: number;
}

export class RevenueResponseDto {
  overview: RevenueOverviewDto;
  byTime: RevenueByTimeDto[];
  bySpecialty: RevenueBySpecialtyDto[];
  byService: RevenueByServiceDto[];
  period: {
    startDate: string;
    endDate: string;
    periodType: string;
  };
}
