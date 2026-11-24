export const SEPAY_V2_CLIENT = Symbol('SEPAY_V2_CLIENT');

export interface CreateSePayOrderInput {
  orderCode: string;
  amount: number;
  durationSeconds?: number;
}

export interface SePayOrder {
  id: string;
  order_code: string;
  amount: number;
  paid_amount?: number;
  status: string;
  bank_name?: string;
  account_number?: string;
  account_holder_name?: string;
  va_number?: string;
  va_holder_name?: string;
  expired_at?: string | null;
  qr_code?: string | null;
  qr_code_url?: string | null;
}

export interface SePayRefund {
  refund_id: string;
  status: string;
  amount: number;
  created_at?: string;
  transaction_id?: string | null;
}

export interface SePayV2Client {
  createOrder(input: CreateSePayOrderInput): Promise<SePayOrder>;
  refundOrder(orderXid: string, amount: number, idempotencyKey: string): Promise<SePayRefund>;
  getRefund(refundId: string): Promise<SePayRefund>;
  verifyWebhook(input: {
    authorization?: string;
    secretKey?: string;
    signature?: string;
    timestamp?: string;
    rawBody: Buffer;
  }): boolean;
}

export interface SePayWebhookPayload {
  id?: string | number;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string | null;
  code?: string | null;
  content?: string;
  transferType?: string;
  transferAmount?: number | string;
  referenceCode?: string;
  description?: string;
}
