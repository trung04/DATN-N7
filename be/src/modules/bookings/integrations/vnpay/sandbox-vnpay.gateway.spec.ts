import { ConfigService } from '@nestjs/config';
import { SandboxVnpayGateway } from './sandbox-vnpay.gateway';
import {
  canonicalizeVnpayParameters,
  signVnpayParameters,
} from './vnpay-signature';

const hashSecret = 'sandbox-test-secret';
const bookingId = '11111111-1111-4111-8111-111111111111';

describe('SandboxVnpayGateway', () => {
  let gateway: SandboxVnpayGateway;

  beforeEach(() => {
    gateway = new SandboxVnpayGateway(
      new ConfigService({
        VNPAY_TMN_CODE: 'SANDBOX01',
        VNPAY_HASH_SECRET: hashSecret,
        VNPAY_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        VNPAY_REFUND_URL:
          'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
        VNPAY_RETURN_URL: 'http://localhost:3000/api/v1/payments/vnpay/return',
        VNPAY_REFUND_CREATE_BY: 'system',
      }),
    );
  });

  it('creates a signed Sandbox payment URL without forcing a bank method', () => {
    const paymentUrl = gateway.createPaymentUrl({
      bookingId,
      bookingCode: 'BK-20261104-ABCDEF1234',
      amount: 1_000_000,
      customerIp: '127.0.0.1',
      createdAt: new Date('2026-11-04T03:00:00.000Z'),
      expiresAt: new Date('2026-11-04T03:15:00.000Z'),
      locale: 'vn',
    });
    const url = new URL(paymentUrl);

    expect(url.hostname).toBe('sandbox.vnpayment.vn');
    expect(url.searchParams.get('vnp_Amount')).toBe('100000000');
    expect(url.searchParams.has('vnp_BankCode')).toBe(false);
    expect(url.searchParams.get('vnp_TxnRef')).toBe(
      '11111111111141118111111111111111',
    );
    expect(url.searchParams.get('vnp_SecureHash')).toMatch(/^[a-f0-9]{128}$/);
  });

  it('verifies and maps a successful VNPAY callback', () => {
    const parameters = {
      vnp_Amount: '100000000',
      vnp_BankCode: 'NCB',
      vnp_CardType: 'QRCODE',
      vnp_PayDate: '20261104101530',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'SANDBOX01',
      vnp_TransactionNo: '14567890',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: '11111111111141118111111111111111',
    };
    const callback = gateway.verifyPaymentCallback({
      ...parameters,
      vnp_SecureHash: signVnpayParameters(parameters, hashSecret),
    });

    expect(callback).toMatchObject({
      signatureValid: true,
      terminalCodeValid: true,
      bookingId,
      amount: 1_000_000,
      responseCode: '00',
      transactionStatus: '00',
      transactionId: '14567890',
      cardType: 'QRCODE',
      bankCode: 'NCB',
    });
    expect(callback.paidAt?.toISOString()).toBe('2026-11-04T03:15:30.000Z');
  });

  it('detects callback data changed after signing', () => {
    const signed = {
      vnp_Amount: '100000000',
      vnp_TmnCode: 'SANDBOX01',
      vnp_TxnRef: '11111111111141118111111111111111',
    };
    const signature = signVnpayParameters(signed, hashSecret);
    const callback = gateway.verifyPaymentCallback({
      ...signed,
      vnp_Amount: '10000',
      vnp_SecureHash: signature,
    });

    expect(callback.signatureValid).toBe(false);
  });

  it('canonicalizes parameters alphabetically with form-style spaces', () => {
    expect(
      canonicalizeVnpayParameters({
        vnp_TxnRef: 'ABC123',
        vnp_OrderInfo: 'Thanh toan booking',
      }),
    ).toBe('vnp_OrderInfo=Thanh+toan+booking&vnp_TxnRef=ABC123');
  });
});
