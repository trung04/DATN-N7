import { BadGatewayException, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS, type PaymentLink, type Payout, type Webhook } from '@payos/node';
import type { PayosGateway, PayosPaymentInfo, PayosRefundInput, PayosRefundResult } from '../../interfaces/payos-gateway.interface';
import { PlatformSettingsService } from '../../../platform-settings/platform-settings.service';
import type { SettingsReader } from '../../../platform-settings/platform-settings.catalog';

const CHECKOUT_ORIGIN = 'https://pay.payos.vn';
const LINK_ID = /^[a-zA-Z0-9-]{16,64}$/;
const OPEN_STATUSES = ['PENDING', 'PROCESSING', 'UNDERPAID'];
// Techcombank head office CITAD (VSDC) to its VietQR BIN (Casso).
const PAYOUT_BIN_BY_CITAD: Readonly<Record<string, string>> = { '01310001': '970407' };

@Injectable()
export class PayosGatewayClient implements PayosGateway {
  private readonly config: SettingsReader;
  private readonly clients = new Map<string, { credentials: string; client: PayOS }>();

  constructor(config: ConfigService, @Optional() settings?: PlatformSettingsService) {
    this.config = settings ?? config;
  }

  isConfigured(): boolean {
    return Boolean(this.credentials('PAYOS'));
  }

  isPayoutConfigured(): boolean {
    return Boolean(this.credentials('PAYOS_PAYOUT'));
  }

  async createPayment(input: Parameters<PayosGateway['createPayment']>[0]) {
    const client = this.paymentClient();
    const resultUrl = new URL(`/bookings/${input.bookingId}/payment-result`, this.config.getOrThrow<string>('FRONTEND_ORIGIN')).href;
    try {
      const link = await client.paymentRequests.create({
        orderCode: input.orderCode,
        amount: input.amount,
        description: `BK${String(input.orderCode).slice(-7)}`,
        returnUrl: resultUrl,
        cancelUrl: resultUrl,
        expiredAt: Math.floor(input.expiresAt.getTime() / 1000),
      });
      const checkout = new URL(link.checkoutUrl);
      if (link.orderCode === input.orderCode && link.amount === input.amount && link.currency === 'VND' &&
          LINK_ID.test(link.paymentLinkId) && checkout.origin === CHECKOUT_ORIGIN &&
          !checkout.username && !checkout.password && OPEN_STATUSES.includes(link.status)) {
        return { linkId: link.paymentLinkId, checkoutUrl: checkout.href };
      }
    } catch {
      // The remote request may have created the link despite a lost response.
      const existing = await this.getPayment(input.orderCode);
      if (existing.amount === input.amount && OPEN_STATUSES.includes(existing.status)) {
        return { linkId: existing.linkId, checkoutUrl: `${CHECKOUT_ORIGIN}/web/${existing.linkId}` };
      }
    }
    throw new BadGatewayException('Không tạo được link thanh toán payOS cho booking này.');
  }

  async getPayment(orderCode: number): Promise<PayosPaymentInfo> {
    const client = this.paymentClient();
    try {
      const link = await client.paymentRequests.get(orderCode);
      if (link.orderCode !== orderCode || !LINK_ID.test(link.id) || !Number.isSafeInteger(link.amount)) {
        throw new Error('Mismatched payOS payment link');
      }
      return { linkId: link.id, orderCode, amount: link.amount, amountPaid: link.amountPaid, status: link.status, paid: this.readPaidTransfer(link) };
    } catch {
      throw new BadGatewayException('Chưa xác minh được trạng thái thanh toán từ payOS.');
    }
  }

  async verifyWebhook(body: unknown) {
    const client = this.paymentClient();
    if (!body || typeof body !== 'object' || !('data' in body) || !('signature' in body)) return null;
    try {
      const data = await client.webhooks.verify(body as Webhook);
      if (!Number.isSafeInteger(data.orderCode) || data.orderCode <= 0 || !LINK_ID.test(data.paymentLinkId)) return null;
      return { orderCode: data.orderCode, linkId: data.paymentLinkId };
    } catch {
      return null;
    }
  }

  async refund(input: PayosRefundInput): Promise<PayosRefundResult> {
    return this.createPayout(input, 'Hoan tien dat phong');
  }

  async submitSettlementPayout(input: PayosRefundInput): Promise<PayosRefundResult> {
    return this.createPayout(input, 'Chi tra khach san');
  }

  private async createPayout(input: PayosRefundInput, description: string): Promise<PayosRefundResult> {
    const payout = await this.payoutClient().payouts.create({
      referenceId: input.requestId,
      amount: input.amount,
      description,
      toBin: input.destination.bank,
      toAccountNumber: input.destination.account,
    }, input.requestId);
    return this.refundResult(input, payout);
  }

  async getRefund(input: PayosRefundInput): Promise<PayosRefundResult> {
    return this.lookupPayout(input);
  }

  async getSettlementPayout(input: PayosRefundInput): Promise<PayosRefundResult> {
    return this.lookupPayout(input);
  }

  private async lookupPayout(input: PayosRefundInput): Promise<PayosRefundResult> {
    const page = await this.payoutClient().payouts.list({ referenceId: input.requestId, limit: 2 });
    const matches = page.data.filter(payout => payout.referenceId === input.requestId);
    return matches.length === 1 ? this.refundResult(input, matches[0]) : { status: 'pending' };
  }

  private readPaidTransfer(link: PaymentLink): PayosPaymentInfo['paid'] {
    if (link.status !== 'PAID' || link.amountPaid !== link.amount || link.amountRemaining !== 0 ||
        !Array.isArray(link.transactions) || link.transactions.length === 0 ||
        !link.transactions.every(row => Number.isSafeInteger(row.amount) && row.amount > 0) ||
        link.transactions.reduce((sum, row) => sum + row.amount, 0) !== link.amount) return null;
    const transactions = link.transactions.map(row => ({ ...row, at: this.readDate(row.transactionDateTime) }));
    if (!transactions.every(row => Number.isFinite(row.at.getTime()) && typeof row.reference === 'string' &&
        /^[\w.-]{1,100}$/.test(row.reference))) return null;
    const last = transactions.reduce((latest, row) => row.at > latest.at ? row : latest);
    const senderBank = last.counterAccountBankId?.trim() ?? '';
    const bank = /^\d{8}$/.test(senderBank) ? PAYOUT_BIN_BY_CITAD[senderBank] ?? '' : senderBank;
    const account = last.counterAccountNumber?.trim() ?? '';
    const destination = transactions.length === 1 && /^\d{6}$/.test(bank) && /^\d{4,24}$/.test(account)
      ? { bank, account }
      : null;
    return { reference: last.reference, at: last.at, destination };
  }

  private readDate(value: string): Date {
    const local = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?$/;
    return new Date(local.test(value) ? `${value.replace(' ', 'T')}+07:00` : value);
  }

  private refundResult(input: PayosRefundInput, payout: Payout): PayosRefundResult {
    if (payout.referenceId !== input.requestId || !Array.isArray(payout.transactions) || payout.transactions.length !== 1) {
      return { status: 'pending' };
    }
    const [transaction] = payout.transactions;
    if (transaction.referenceId !== input.requestId || transaction.amount !== input.amount ||
        transaction.toBin !== input.destination.bank || transaction.toAccountNumber !== input.destination.account) {
      return { status: 'pending' };
    }
    const reference = transaction.reference || transaction.id;
    if (transaction.state === 'SUCCEEDED' && typeof reference === 'string' && /^[\w.-]{1,120}$/.test(reference)) {
      return { status: 'succeeded', reference, payoutId: payout.id };
    }
    return { status: ['FAILED', 'CANCELLED'].includes(transaction.state) ? 'rejected' : 'pending' };
  }

  private credentials(prefix: string) {
    const clientId = this.config.get<string>(`${prefix}_CLIENT_ID`)?.trim();
    const apiKey = this.config.get<string>(`${prefix}_API_KEY`)?.trim();
    const checksumKey = this.config.get<string>(`${prefix}_CHECKSUM_KEY`)?.trim();
    return clientId && apiKey && checksumKey ? { clientId, apiKey, checksumKey } : null;
  }

  private client(prefix: string): PayOS | null {
    const credentials = this.credentials(prefix);
    if (!credentials) return null;
    const fingerprint = JSON.stringify(credentials);
    const cached = this.clients.get(prefix);
    if (cached?.credentials === fingerprint) return cached.client;
    const client = new PayOS({
      ...credentials, baseURL: 'https://api-merchant.payos.vn',
      timeout: 8000, maxRetries: 0, fetchOptions: { redirect: 'error' }, logLevel: 'off',
    });
    this.clients.set(prefix, { credentials: fingerprint, client });
    return client;
  }

  private paymentClient(): PayOS {
    const client = this.client('PAYOS');
    if (!client) throw new ServiceUnavailableException('Chưa cấu hình kênh thanh toán payOS.');
    return client;
  }

  private payoutClient(): PayOS {
    const client = this.client('PAYOS_PAYOUT');
    if (!client) throw new ServiceUnavailableException('Chưa cấu hình Kênh chi payOS.');
    return client;
  }
}
