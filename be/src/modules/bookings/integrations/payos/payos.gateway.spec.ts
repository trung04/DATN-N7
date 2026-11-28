import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { PaymentLink, Payout } from '@payos/node';
import { PayosGatewayClient } from './payos.gateway';

const checksum = 'test-checksum-key';
const hash = (value: string) => createHmac('sha256', checksum).update(value).digest('hex');
const sign = (data: Record<string, string | number>) =>
  hash(Object.keys(data).sort().map(key => `${key}=${data[key]}`).join('&'));

const configuration = () => new ConfigService({
  PAYOS_CLIENT_ID: 'test-id',
  PAYOS_API_KEY: 'test-api-key',
  PAYOS_CHECKSUM_KEY: checksum,
  FRONTEND_ORIGIN: 'http://localhost:8080',
});

describe('PayosGatewayClient', () => {
  it.each([
    ['01310001', '1234567890', { bank: '970407', account: '1234567890' }],
    ['970422', '1234567890', { bank: '970422', account: '1234567890' }],
    ['01310002', '1234567890', null],
    ['01310001', '1234****90', null],
  ] as const)('validates the payOS refund destination for sender bank %s', async (bank, account, destination) => {
    const gateway = new PayosGatewayClient(configuration());
    const orderCode = 12345678901234;
    const linkId = '1234567890abcdefgh1234567890abcd';
    const link = {
      id: linkId, orderCode, status: 'PAID', amount: 2000, amountPaid: 2000, amountRemaining: 0,
      transactions: [{
        amount: 2000, reference: 'PAYMENT-1', transactionDateTime: '2026-11-27T23:54:00+07:00',
        counterAccountBankId: bank, counterAccountNumber: account,
      }],
    } as PaymentLink;
    jest.spyOn(gateway['paymentClient']().paymentRequests, 'get').mockResolvedValue(link);
    await expect(gateway.getPayment(orderCode)).resolves.toMatchObject({
      paid: { reference: 'PAYMENT-1', destination },
    });
  });

  it('verifies the signature of a webhook and rejects a modified order code', async () => {
    const client = new PayosGatewayClient(configuration());
    const data = {
      orderCode: 12345678901234,
      paymentLinkId: '1234567890abcdefgh1234567890abcd',
      amount: 2000,
      description: 'BK8901234',
      accountNumber: '123456789',
      reference: 'TEST1',
      transactionDateTime: '2026-11-27 15:00:00',
      currency: 'VND',
      code: '00',
      desc: 'success',
    };
    const signature = sign(data);
    const body = { code: '00', success: true, desc: 'success', data, signature };
    await expect(client.verifyWebhook(body)).resolves.toEqual({ orderCode: data.orderCode, linkId: data.paymentLinkId });
    await expect(client.verifyWebhook({ ...body, data: { ...data, orderCode: 2 } })).resolves.toBeNull();
    expect(client.isPayoutConfigured()).toBe(false);
  });

  it('uses the provider checkout link after signing the create request', async () => {
    const linkId = '1234567890abcdefgh1234567890abcd';
    const data = {
      orderCode: 12345678901234, amount: 2000, currency: 'VND', paymentLinkId: linkId,
      checkoutUrl: `https://pay.payos.vn/web/${linkId}`, status: 'PENDING',
    };
    const response = new Response(JSON.stringify({ code: '00', desc: 'success', data, signature: sign(data) }), {
      headers: { 'Content-Type': 'application/json' },
    });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response);
    try {
      const gateway = new PayosGatewayClient(configuration());
      const bookingId = '00000000-0000-4000-8000-000000000001';
      const expiresAt = new Date('2026-11-27T12:00:00Z');
      await expect(gateway.createPayment({ bookingId, orderCode: data.orderCode, amount: data.amount, expiresAt }))
        .resolves.toEqual({ linkId, checkoutUrl: data.checkoutUrl });
      const request = fetchMock.mock.calls[0][1];
      const body = JSON.parse(String(request?.body));
      const result = `http://localhost:8080/bookings/${bookingId}/payment-result`;
      expect(body).toMatchObject({ orderCode: data.orderCode, amount: data.amount, expiredAt: expiresAt.getTime() / 1000,
        returnUrl: result, cancelUrl: result, signature: hash(`amount=2000&cancelUrl=${result}&description=BK8901234&orderCode=12345678901234&returnUrl=${result}`),
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('uses the saved reference as the payout idempotency key and checks the bank transaction', async () => {
    const gateway = new PayosGatewayClient(new ConfigService({
      PAYOS_PAYOUT_CLIENT_ID: 'test-payout-id',
      PAYOS_PAYOUT_API_KEY: 'test-payout-api-key',
      PAYOS_PAYOUT_CHECKSUM_KEY: checksum,
    }));
    const input = { requestId: 'saved-payout-reference', amount: 850_000, destination: { bank: '970407', account: '0123456789' } };
    const transaction = {
      id: 'txn-01',
      reference: 'bank-01',
      referenceId: input.requestId,
      amount: input.amount,
      toBin: input.destination.bank,
      toAccountNumber: input.destination.account,
      state: 'SUCCEEDED',
    };
    const payout = { id: 'payout-01', referenceId: input.requestId, transactions: [transaction] } as Payout;
    const create = jest.spyOn(gateway['payoutClient']().payouts, 'create').mockResolvedValueOnce(payout);
    await expect(gateway.submitSettlementPayout(input)).resolves.toEqual({
      status: 'succeeded', reference: 'bank-01', payoutId: 'payout-01',
    });
    expect(create).toHaveBeenCalledWith({
      referenceId: input.requestId, amount: input.amount, description: 'Chi tra khach san',
      toBin: input.destination.bank, toAccountNumber: input.destination.account,
    }, input.requestId);

    create.mockResolvedValueOnce({ ...payout, transactions: [{ ...payout.transactions[0], amount: 1 }] });
    await expect(gateway.submitSettlementPayout(input)).resolves.toEqual({ status: 'pending' });
  });
});
