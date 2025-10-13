export class TopServiceDto {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  usageCount: number;
  totalRevenue: number;
  paidRevenue: number;
  revenuePercent: number;
  usagePercent: number;
}

export class TopPackageDto {
  packageId: string;
  packageName: string;
  packageCode: string;
  usageCount: number;
  totalRevenue: number;
  paidRevenue: number;
  revenuePercent: number;
  usagePercent: number;
}

export class RevenueStructureDto {
  category: string;
  categoryName: string;
  totalRevenue: number;
  revenuePercent: number;
  itemCount: number;
}

export class TopServicesStatsResponseDto {
  topServices: TopServiceDto[];
  topPackages: TopPackageDto[];
  revenueStructure: RevenueStructureDto[];
  summary: {
    totalServiceRevenue: number;
    totalPackageRevenue: number;
    totalServiceUsage: number;
    totalPackageUsage: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}
