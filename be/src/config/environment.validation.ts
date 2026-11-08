/** Never include secret values in configuration errors. */
export function validateEnvironment(input: Record<string, unknown>) {
  const config = { ...input };
  for (const key of [
    'DATABASE_HOST',
    'DATABASE_NAME',
    'DATABASE_USER',
    'DATABASE_PASSWORD',
  ]) {
    if (typeof config[key] !== 'string' || !(config[key] as string).trim()) {
      throw new Error(`${key} is required`);
    }
  }
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const raw = config[key] ?? fallback;
    if (typeof raw !== 'string' && typeof raw !== 'number') {
      throw new Error(`${key} must be an integer`);
    }
    const value = Number(raw);
    if (
      !/^\d+$/.test(String(raw)) ||
      !Number.isSafeInteger(value) ||
      value < min ||
      value > max
    ) {
      throw new Error(`${key} must be an integer between ${min} and ${max}`);
    }
    config[key] = value;
  };
  integer('PORT', 3000, 1, 65535);
  integer('DATABASE_PORT', 5432, 1, 65535);
  integer('DATABASE_POOL_SIZE', 10, 1, 100);
  integer('DATABASE_CONNECT_TIMEOUT_MS', 5000, 1, 120000);
  integer('REDIS_PORT', 6379, 1, 65535);
  integer('REDIS_DB', 0, 0, 15);
  integer('REDIS_CONNECT_TIMEOUT_MS', 5000, 1, 120000);
  integer('CACHE_TTL_MS', 60000, 1, 86400000);
  integer('BOOKING_HOLD_MINUTES', 15, 5, 1440);
  integer('IDEMPOTENCY_KEY_TTL_HOURS', 24, 1, 168);
  const decimal = (key: string, fallback: number, min: number, max: number) => {
    const raw = config[key] ?? fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${key} must be a number between ${min} and ${max}`);
    }
    config[key] = value;
  };
  decimal('BOOKING_COMMISSION_RATE', 15, 0, 100);
  config.REDIS_HOST ??= 'localhost';
  if (typeof config.REDIS_HOST !== 'string' || !config.REDIS_HOST.trim()) {
    throw new Error('REDIS_HOST must be nonempty');
  }
  for (const key of ['DATABASE_SSL', 'REDIS_TLS']) {
    const value = config[key] ?? 'false';
    if (value !== 'true' && value !== 'false')
      throw new Error(`${key} must be true or false`);
    config[key] = value === 'true';
  }

  config.VNPAY_PAYMENT_URL ??=
    'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  config.VNPAY_REFUND_URL ??=
    'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
  config.VNPAY_REFUND_CREATE_BY ??= 'system';

  for (const key of ['VNPAY_PAYMENT_URL', 'VNPAY_REFUND_URL']) {
    validateSandboxVnpayUrl(config, key);
  }
  if (
    typeof config.VNPAY_REFUND_CREATE_BY !== 'string' ||
    !config.VNPAY_REFUND_CREATE_BY.trim()
  ) {
    throw new Error('VNPAY_REFUND_CREATE_BY must be nonempty');
  }

  const requiredVnpayKeys = [
    'VNPAY_TMN_CODE',
    'VNPAY_HASH_SECRET',
    'VNPAY_RETURN_URL',
  ];
  const hasVnpayConfiguration = requiredVnpayKeys.some(
    (key) => config[key] !== undefined,
  );
  if (hasVnpayConfiguration) {
    for (const key of requiredVnpayKeys) {
      if (typeof config[key] !== 'string' || !config[key].trim()) {
        throw new Error(`${key} is required when VNPAY is configured`);
      }
    }
    validateHttpUrl(config, 'VNPAY_RETURN_URL');
  }
  return config;
}

function validateSandboxVnpayUrl(
  config: Record<string, unknown>,
  key: string,
): void {
  validateHttpUrl(config, key);
  const url = new URL(config[key] as string);
  if (url.protocol !== 'https:' || url.hostname !== 'sandbox.vnpayment.vn') {
    throw new Error(`${key} must use the VNPAY Sandbox HTTPS host`);
  }
}

function validateHttpUrl(config: Record<string, unknown>, key: string): void {
  if (typeof config[key] !== 'string' || !config[key].trim()) {
    throw new Error(`${key} must be a valid HTTP URL`);
  }
  try {
    const url = new URL(config[key]);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error();
  } catch {
    throw new Error(`${key} must be a valid HTTP URL`);
  }
}
