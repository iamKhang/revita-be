export interface PendingServiceDto {
  serviceId: string;
  serviceName: string;
}

export interface PendingServicesResponseDto {
  prescriptionId: string;
  prescriptionCode: string;
  services: PendingServiceDto[];
  status: 'PENDING';
  totalCount: number;
}
