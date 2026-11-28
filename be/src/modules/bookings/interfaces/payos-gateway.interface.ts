export const PAYOS_GATEWAY = Symbol('PAYOS_GATEWAY');

export interface PayosRefundDestination {
  bank: string;
  account: string;
}

export interface PayosPaymentInfo {
  linkId: string;
  orderCode: number;
  amount: number;
  amountPaid: number;
  status: string;
  paid: { reference: string; at: Date; destination: PayosRefundDestination | null } | null;
}

export interface PayosRefundInput {
  requestId: string;
  amount: number;
  destination: PayosRefundDestination;
}

export type PayosRefundResult = { status: 'succeeded' | 'rejected' | 'pending'; reference?: string; payoutId?: string };

export interface PayosGateway {
  isConfigured(): boolean;
  isPayoutConfigured(): boolean;
  createPayment(input: {
    bookingId: string;
    orderCode: number;
    amount: number;
    expiresAt: Date;
  }): Promise<{ linkId: string; checkoutUrl: string }>;
  getPayment(orderCode: number): Promise<PayosPaymentInfo>;
  verifyWebhook(body: unknown): Promise<{ orderCode: number; linkId: string } | null>;
  refund(input: PayosRefundInput): Promise<PayosRefundResult>;
  getRefund(input: PayosRefundInput): Promise<PayosRefundResult>;
  submitSettlementPayout(input: PayosRefundInput): Promise<PayosRefundResult>;
  getSettlementPayout(input: PayosRefundInput): Promise<PayosRefundResult>;
}
