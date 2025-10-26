export interface ServiceToStartDto {
  prescriptionId: string;
  serviceId: string;
}

export interface StartServicesDto {
  services: ServiceToStartDto[];
}

export interface StartServicesResponseDto {
  success: boolean;
  startedServices: {
    prescriptionId: string;
    serviceId: string;
    status: string;
    startedAt: string;
  }[];
  failedServices: {
    prescriptionId: string;
    serviceId: string;
    reason: string;
  }[];
  totalStarted: number;
  totalFailed: number;
}
