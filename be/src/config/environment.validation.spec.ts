import { validateEnvironment } from './environment.validation';

const database = {
  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'tourism_test',
  DATABASE_USER: 'test',
  DATABASE_PASSWORD: 'test-only-secret',
};

describe('environment validation', () => {
  it('normalizes ports, TTL and TLS flags without changing credentials', () => {
    const result = validateEnvironment({
      ...database,
      DATABASE_SSL: 'true',
      REDIS_PORT: '6380',
    });
    expect(result.DATABASE_SSL).toBe(true);
    expect(result.REDIS_TLS).toBe(false);
    expect(result.REDIS_PORT).toBe(6380);
    expect(result.CACHE_TTL_MS).toBe(60000);
    expect(result.AUTH_ACCESS_TTL_MS).toBe(900000);
    expect(result.AUTH_REFRESH_TTL_MS).toBe(604800000);
    expect(result.FRONTEND_ORIGIN).toBe('http://localhost:5173');
    expect(result.BOOKING_COMMISSION_RATE).toBe(15);
    expect(result.BOOKING_HOLD_MINUTES).toBe(15);
    expect(result.IDEMPOTENCY_KEY_TTL_HOURS).toBe(24);
    expect(result.DATABASE_PASSWORD).toBe(database.DATABASE_PASSWORD);
    expect(result.VNPAY_PAYMENT_URL).toBe(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    );
  });

  it.each([
    ['DATABASE_PORT', '5432abc'],
    ['REDIS_PORT', '65536'],
    ['DATABASE_POOL_SIZE', '0'],
    ['CACHE_TTL_MS', '-1'],
    ['AUTH_ACCESS_TTL_MS', '0'],
    ['AUTH_REFRESH_TTL_MS', '99999999999'],
    ['REDIS_DB', '1.5'],
    ['REDIS_TLS', 'yes'],
    ['DATABASE_SSL', '1'],
    ['REDIS_HOST', ''],
    ['DATABASE_PASSWORD', ''],
    ['BOOKING_COMMISSION_RATE', '101'],
    ['BOOKING_HOLD_MINUTES', '0'],
    ['IDEMPOTENCY_KEY_TTL_HOURS', '169'],
  ])('rejects invalid %s', (key, value) => {
    expect(() => validateEnvironment({ ...database, [key]: value })).toThrow(
      key,
    );
  });

  it('fails on missing database credentials', () => {
    expect(() => validateEnvironment({})).toThrow('DATABASE_HOST is required');
  });

  it('requires refresh lifetime to exceed access lifetime', () => {
    expect(() =>
      validateEnvironment({
        ...database,
        AUTH_ACCESS_TTL_MS: '3600000',
        AUTH_REFRESH_TTL_MS: '3600000',
      }),
    ).toThrow('AUTH_REFRESH_TTL_MS must exceed AUTH_ACCESS_TTL_MS');
  });

  it('rejects a frontend URL that is not an origin', () => {
    expect(() =>
      validateEnvironment({
        ...database,
        FRONTEND_ORIGIN: 'https://example.com/path',
      }),
    ).toThrow('FRONTEND_ORIGIN');
  });

  it('accepts a complete VNPAY Sandbox configuration', () => {
    const result = validateEnvironment({
      ...database,
      VNPAY_TMN_CODE: 'SANDBOX01',
      VNPAY_HASH_SECRET: 'test-only-vnpay-secret',
      VNPAY_RETURN_URL: 'http://localhost:3000/api/v1/payments/vnpay/return',
    });
    expect(result.VNPAY_TMN_CODE).toBe('SANDBOX01');
  });

  it('rejects a partial VNPAY configuration', () => {
    expect(() =>
      validateEnvironment({ ...database, VNPAY_TMN_CODE: 'SANDBOX01' }),
    ).toThrow('VNPAY_HASH_SECRET');
  });

  it('rejects a production VNPAY payment URL', () => {
    expect(() =>
      validateEnvironment({
        ...database,
        VNPAY_PAYMENT_URL: 'https://pay.vnpay.vn/paymentv2/vpcpay.html',
      }),
    ).toThrow('VNPAY_PAYMENT_URL');
  });

  it('rejects a partial Google configuration', () => {
    expect(() =>
      validateEnvironment({ ...database, GOOGLE_CLIENT_ID: 'client-id' }),
    ).toThrow('GOOGLE_CLIENT_SECRET');
  });

  it('accepts a complete Google configuration', () => {
    const result = validateEnvironment({
      ...database,
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'test-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/google/callback',
    });
    expect(result.GOOGLE_CLIENT_ID).toBe('client-id');
  });

});
