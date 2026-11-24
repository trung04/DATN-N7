import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { SEPAY_V2_CLIENT } from '../../interfaces/sepay-v2.interface';
import type {
  CreateSePayOrderInput,
  SePayOrder,
  SePayRefund,
  SePayV2Client,
} from '../../interfaces/sepay-v2.interface';

interface SePayEnvelope<T> {
  status?: string;
  data?: T;
  message?: string;
  error_code?: string;
}

export class SePayV2RequestException extends BadGatewayException {
  constructor(
    readonly providerStatus: number,
    readonly providerErrorCode: string,
  ) {
    super(`SePay API v2 rejected the request (HTTP ${providerStatus}, ${providerErrorCode}).`);
  }
}

@Injectable()
export class SePayV2ClientImpl implements SePayV2Client {
  constructor(private readonly config: ConfigService) {}

  async createOrder(input: CreateSePayOrderInput): Promise<SePayOrder> {
    const data = await this.request<SePayOrder>(`/bank-accounts/${this.bankAccountXid()}/orders`, {
      method: 'POST',
      body: JSON.stringify({
        order_code: input.orderCode,
        amount: input.amount,
        duration: input.durationSeconds,
        with_qrcode: '1',
        ...(this.config.get<string>('SEPAY_V2_TERMINAL_ID')
          ? { tid: this.config.get<string>('SEPAY_V2_TERMINAL_ID') }
          : {}),
      }),
    });
    return data;
  }

  async refundOrder(orderXid: string, amount: number, idempotencyKey: string): Promise<SePayRefund> {
    return this.request<SePayRefund>(
      `/bank-accounts/${this.bankAccountXid()}/orders/${encodeURIComponent(orderXid)}/refund`,
      {
        method: 'POST',
        headers: { 'X-Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ refund_amount: amount }),
      },
    );
  }

  getRefund(refundId: string): Promise<SePayRefund> {
    return this.request<SePayRefund>(
      `/bank-accounts/${this.bankAccountXid()}/refunds/${encodeURIComponent(refundId)}`,
      { method: 'GET' },
    );
  }

  verifyWebhook(input: {
    authorization?: string;
    secretKey?: string;
    signature?: string;
    timestamp?: string;
    rawBody: Buffer;
  }): boolean {
    const authType = this.config.get<string>('SEPAY_WEBHOOK_AUTH_TYPE') ?? 'HMAC_SHA256';
    if (authType === 'API_KEY') {
      const expected = this.config.get<string>('SEPAY_WEBHOOK_API_KEY') ?? '';
      return this.safeEqual(input.authorization ?? '', `Apikey ${expected}`) && Boolean(expected);
    }
    const secret = this.config.get<string>('SEPAY_WEBHOOK_SECRET') ?? '';
    if (!secret) return false;

    // Supports the legacy dashboard's X-Secret-Key mode and current SePay
    // HMAC-SHA256 webhook mode. Prefer HMAC for new webhook configurations.
    if (input.secretKey && this.safeEqual(input.secretKey, secret)) return true;
    const timestamp = Number(input.timestamp);
    if (!input.signature || !Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
      return false;
    }
    const digest = createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(input.rawBody)
      .digest('hex');
    return this.safeEqual(input.signature, `sha256=${digest}`);
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const baseUrl = this.config.get<string>('SEPAY_V2_BASE_URL') ?? 'https://userapi-sandbox.sepay.vn/v2';
    const token = this.config.get<string>('SEPAY_V2_API_TOKEN') ?? '';
    if (!token) throw new BadGatewayException('SePay API v2 Sandbox is not configured.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('Accept', 'application/json');
      if (init.body) headers.set('Content-Type', 'application/json');
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers,
      });
      const envelope = await response.json().catch(() => ({})) as SePayEnvelope<T>;
      if (!response.ok || !envelope.data) {
        const code = (envelope.error_code ?? 'unexpected_response').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
        throw new SePayV2RequestException(response.status, code);
      }
      return envelope.data;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('SePay API v2 is temporarily unavailable. Retry using the same booking/refund request.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private bankAccountXid(): string {
    const xid = this.config.get<string>('SEPAY_V2_BANK_ACCOUNT_XID') ?? '';
    if (!xid) throw new BadGatewayException('SePay Sandbox bank account is not configured.');
    return encodeURIComponent(xid);
  }

  private safeEqual(actual: string, expected: string): boolean {
    const actualBytes = Buffer.from(actual, 'utf8');
    const expectedBytes = Buffer.from(expected, 'utf8');
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
  }
}

export { SEPAY_V2_CLIENT };
