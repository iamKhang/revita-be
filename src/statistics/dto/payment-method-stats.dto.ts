export class RevenueByPaymentMethodDto {
  paymentMethod: 'CASH' | 'TRANSFER';
  totalRevenue: number;
  paidRevenue: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  paidPercent: number;
  revenuePercent: number;
}

export class PaymentMethodStatsResponseDto {
  byPaymentMethod: RevenueByPaymentMethodDto[];
  summary: {
    totalRevenue: number;
    paidRevenue: number;
    totalInvoices: number;
    paidInvoices: number;
    overallPaidPercent: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}
