export const VNPAY_PAYMENT_GATEWAY = Symbol('VNPAY_PAYMENT_GATEWAY');

export type VnpayLocale = 'vn' | 'en';

export interface CreateVnpayPaymentInput {
  bookingId: string;
  bookingCode: string;
  amount: number;
  customerIp: string;
  createdAt: Date;
  expiresAt: Date;
  locale: VnpayLocale;
}

export interface VnpayPaymentCallback {
  signatureValid: boolean;
  terminalCodeValid: boolean;
  bookingId: string | null;
  amount: number | null;
  responseCode: string | null;
  transactionStatus: string | null;
  transactionId: string | null;
  cardType: string | null;
  bankCode: string | null;
  paidAt: Date | null;
}

export interface RefundVnpayPaymentInput {
  bookingId: string;
  amount: number;
  originalAmount: number;
  originalTransactionId: string;
  originalTransactionDate: Date;
  reason: string;
  customerIp: string;
}

export interface VnpayRefundResult {
  requestId: string;
  responseCode: string;
  transactionStatus: string | null;
  transactionId: string | null;
  payDate: Date | null;
}

export interface VnpayPaymentGateway {
  createPaymentUrl(input: CreateVnpayPaymentInput): string;
  verifyPaymentCallback(query: Record<string, unknown>): VnpayPaymentCallback;
  refund(input: RefundVnpayPaymentInput): Promise<VnpayRefundResult>;
}
