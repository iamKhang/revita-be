export interface PendingServiceDto {
  serviceId: string;
  serviceName: string;
}

export interface PendingServicesResponseDto {
  prescriptionCode: string;
  services: PendingServiceDto[];
  status: 'PENDING';
  totalCount: number;
}
