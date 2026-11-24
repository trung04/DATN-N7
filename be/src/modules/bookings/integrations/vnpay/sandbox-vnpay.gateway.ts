import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  VnpayInvalidResponseException,
  VnpayNotConfiguredException,
  VnpayUnavailableException,
} from '../../exceptions/booking.exceptions';
import type {
  CreateVnpayPaymentInput,
  RefundVnpayPaymentInput,
  VnpayPaymentCallback,
  VnpayPaymentGateway,
  VnpayRefundResult,
} from '../../interfaces/vnpay-payment-gateway.interface';
import { formatVnpayDate, parseVnpayDate } from './vnpay-date';
import {
  canonicalizeVnpayParameters,
  signVnpayParameters,
  verifyVnpaySignature,
} from './vnpay-signature';

interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  paymentUrl: string;
  refundUrl: string;
  returnUrl: string;
  refundCreateBy: string;
}

@Injectable()
export class SandboxVnpayGateway implements VnpayPaymentGateway {
  constructor(private readonly configService: ConfigService) {}

  createPaymentUrl(input: CreateVnpayPaymentInput): string {
    const config = this.getConfig();
    const parameters: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: config.tmnCode,
      vnp_Amount: this.toVnpayAmount(input.amount),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: this.toTransactionReference(input.bookingId),
      vnp_OrderInfo: `Thanh toan booking ${input.bookingCode}`,
      vnp_OrderType: 'other',
      vnp_Locale: input.locale,
      vnp_ReturnUrl: config.returnUrl,
      vnp_IpAddr: input.customerIp,
      vnp_CreateDate: formatVnpayDate(input.createdAt),
      vnp_ExpireDate: formatVnpayDate(input.expiresAt),
    };
    const signature = signVnpayParameters(parameters, config.hashSecret);
    return `${config.paymentUrl}?${canonicalizeVnpayParameters(parameters)}&vnp_SecureHash=${signature}`;
  }

  verifyPaymentCallback(query: Record<string, unknown>): VnpayPaymentCallback {
    const config = this.getConfig();
    const signature = this.singleString(query.vnp_SecureHash);
    const parameters = this.normalizeCallbackParameters(query);
    const signatureValid = Boolean(
      signature &&
      verifyVnpaySignature(parameters, signature, config.hashSecret),
    );
    const transactionReference = parameters.vnp_TxnRef ?? null;
    const rawAmount = parameters.vnp_Amount;

    return {
      signatureValid,
      terminalCodeValid: parameters.vnp_TmnCode === config.tmnCode,
      bookingId: this.fromTransactionReference(transactionReference),
      amount:
        rawAmount && /^\d+$/.test(rawAmount) ? Number(rawAmount) / 100 : null,
      responseCode: parameters.vnp_ResponseCode ?? null,
      transactionStatus: parameters.vnp_TransactionStatus ?? null,
      transactionId: parameters.vnp_TransactionNo ?? null,
      cardType: parameters.vnp_CardType ?? null,
      bankCode: parameters.vnp_BankCode ?? null,
      paidAt: parseVnpayDate(parameters.vnp_PayDate ?? null),
    };
  }

  async refund(input: RefundVnpayPaymentInput): Promise<VnpayRefundResult> {
    const config = this.getConfig();
    const createdAt = new Date();
    const requestId = randomUUID().replaceAll('-', '');
    const parameters: Record<string, string> = {
      vnp_RequestId: requestId,
      vnp_Version: '2.1.0',
      vnp_Command: 'refund',
      vnp_TmnCode: config.tmnCode,
      vnp_TransactionType: input.amount === input.originalAmount ? '02' : '03',
      vnp_TxnRef: this.toTransactionReference(input.bookingId),
      vnp_Amount: this.toVnpayAmount(input.amount),
      vnp_TransactionNo: input.originalTransactionId,
      vnp_TransactionDate: formatVnpayDate(input.originalTransactionDate),
      vnp_CreateBy: config.refundCreateBy,
      vnp_CreateDate: formatVnpayDate(createdAt),
      vnp_IpAddr: input.customerIp,
      vnp_OrderInfo: input.reason,
    };
    const checksumData = [
      parameters.vnp_RequestId,
      parameters.vnp_Version,
      parameters.vnp_Command,
      parameters.vnp_TmnCode,
      parameters.vnp_TransactionType,
      parameters.vnp_TxnRef,
      parameters.vnp_Amount,
      parameters.vnp_TransactionNo,
      parameters.vnp_TransactionDate,
      parameters.vnp_CreateBy,
      parameters.vnp_CreateDate,
      parameters.vnp_IpAddr,
      parameters.vnp_OrderInfo,
    ].join('|');
    parameters.vnp_SecureHash = this.signRaw(checksumData, config.hashSecret);

    let response: Response;
    try {
      response = await fetch(config.refundUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parameters),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new VnpayUnavailableException();
    }
    if (!response.ok) throw new VnpayUnavailableException();

    let payload: Record<string, unknown>;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new VnpayInvalidResponseException();
    }
    if (!this.verifyRefundResponse(payload, config.hashSecret)) {
      throw new VnpayInvalidResponseException();
    }
    return {
      requestId,
      responseCode: this.singleString(payload.vnp_ResponseCode) ?? '99',
      transactionStatus: this.singleString(payload.vnp_TransactionStatus),
      transactionId: this.singleString(payload.vnp_TransactionNo),
      payDate: parseVnpayDate(this.singleString(payload.vnp_PayDate)),
    };
  }

  private getConfig(): VnpayConfig {
    const config: VnpayConfig = {
      tmnCode: this.configService.get<string>('VNPAY_TMN_CODE') ?? '',
      hashSecret: this.configService.get<string>('VNPAY_HASH_SECRET') ?? '',
      paymentUrl: this.configService.get<string>('VNPAY_PAYMENT_URL') ?? '',
      refundUrl: this.configService.get<string>('VNPAY_REFUND_URL') ?? '',
      returnUrl: this.configService.get<string>('VNPAY_RETURN_URL') ?? '',
      refundCreateBy:
        this.configService.get<string>('VNPAY_REFUND_CREATE_BY') ?? 'system',
    };
    if (
      !config.tmnCode ||
      !config.hashSecret ||
      !config.paymentUrl ||
      !config.refundUrl ||
      !config.returnUrl
    ) {
      throw new VnpayNotConfiguredException();
    }
    return config;
  }

  private normalizeCallbackParameters(
    query: Record<string, unknown>,
  ): Record<string, string> {
    const parameters: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (
        !key.startsWith('vnp_') ||
        key === 'vnp_SecureHash' ||
        key === 'vnp_SecureHashType'
      ) {
        continue;
      }
      const normalized = this.singleString(value);
      if (normalized !== null) parameters[key] = normalized;
    }
    return parameters;
  }

  private verifyRefundResponse(
    payload: Record<string, unknown>,
    hashSecret: string,
  ): boolean {
    const receivedSignature = this.singleString(payload.vnp_SecureHash);
    if (!receivedSignature) return false;
    const checksumData = [
      'vnp_ResponseId',
      'vnp_Command',
      'vnp_ResponseCode',
      'vnp_Message',
      'vnp_TmnCode',
      'vnp_TxnRef',
      'vnp_Amount',
      'vnp_BankCode',
      'vnp_PayDate',
      'vnp_TransactionNo',
      'vnp_TransactionType',
      'vnp_TransactionStatus',
      'vnp_OrderInfo',
    ]
      .map((key) => this.singleString(payload[key]) ?? '')
      .join('|');
    const expected = this.signRaw(checksumData, hashSecret);
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(receivedSignature.toLowerCase(), 'utf8');
    return (
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  }

  private signRaw(data: string, hashSecret: string): string {
    return createHmac('sha512', hashSecret).update(data, 'utf8').digest('hex');
  }

  private toVnpayAmount(amount: number): string {
    return String(Math.round(amount * 100));
  }

  private toTransactionReference(bookingId: string): string {
    return bookingId.replaceAll('-', '');
  }

  private fromTransactionReference(value: string | null): string | null {
    if (!value || !/^[0-9a-fA-F]{32}$/.test(value)) return null;
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`.toLowerCase();
  }

  private singleString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }
}
