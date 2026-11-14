/** Never include secret values in configuration errors. */
export function validateEnvironment(input: Record<string, unknown>) {
  const config = { ...input };
  for (const [postgresKey, databaseKey] of Object.entries({
    POSTGRES_HOST: 'DATABASE_HOST',
    POSTGRES_PORT: 'DATABASE_PORT',
    POSTGRES_NAME: 'DATABASE_NAME',
    POSTGRES_USER: 'DATABASE_USER',
    POSTGRES_PASSWORD: 'DATABASE_PASSWORD',
    POSTGRES_SSL: 'DATABASE_SSL',
    POSTGRES_POOL_SIZE: 'DATABASE_POOL_SIZE',
    POSTGRES_CONNECT_TIMEOUT_MS: 'DATABASE_CONNECT_TIMEOUT_MS',
  })) {
    config[databaseKey] ??= config[postgresKey];
  }
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
  integer('AI_TIMEOUT_MS', 15000, 1, 120000);
  config.S3_ENDPOINT ??= 'http://localhost:9002';
  validateHttpOrigin(config, 'S3_ENDPOINT');
  const storageUrl = new URL(String(config.S3_ENDPOINT));
  if (
    storageUrl.username ||
    storageUrl.password ||
    storageUrl.search ||
    storageUrl.hash
  ) {
    throw new Error(
      'S3_ENDPOINT must not contain credentials, query or fragment',
    );
  }
  config.S3_REGION ??= 'us-east-1';
  if (
    typeof config.S3_REGION !== 'string' ||
    !/^[a-z0-9-]+$/.test(config.S3_REGION)
  )
    throw new Error('S3_REGION is invalid');
  config.S3_HOTEL_IMAGES_BUCKET ??= 'hotel-images';
  if (
    typeof config.S3_HOTEL_IMAGES_BUCKET !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.S3_HOTEL_IMAGES_BUCKET)
  )
    throw new Error('S3_HOTEL_IMAGES_BUCKET is invalid');
  const storageKeys = ['S3_ACCESS_KEY', 'S3_SECRET_KEY'];
  if (
    storageKeys.some((key) => config[key] !== undefined && config[key] !== '')
  ) {
    for (const key of storageKeys) {
      if (typeof config[key] !== 'string' || !config[key].trim())
        throw new Error(`${key} is required when S3 is configured`);
    }
  }
  config.AI_BASE_URL ??= 'http://localhost:9000';
  try {
    const url = new URL(String(config.AI_BASE_URL));
    if (
      typeof config.AI_BASE_URL !== 'string' ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      throw new Error('invalid');
    }
    config.AI_BASE_URL = url.origin;
  } catch {
    throw new Error(
      'AI_BASE_URL must be an HTTP(S) origin without credentials',
    );
  }
  config.AI_API_KEY ??= '';
  if (typeof config.AI_API_KEY !== 'string') {
    throw new Error('AI_API_KEY must be a string');
  }
  integer('AUTH_ACCESS_TTL_MS', 900000, 60000, 3600000);
  integer('AUTH_REFRESH_TTL_MS', 604800000, 3600000, 2592000000);
  integer('SMTP_PORT', 587, 1, 65535);
  config.SMTP_HOST ??= '';
  config.SMTP_USER ??= '';
  config.SMTP_PASSWORD ??= '';
  config.EMAIL_FROM ??= '';
  config.AUTH_OTP_PEPPER ??= '';
  if (typeof config.SMTP_HOST !== 'string' || typeof config.SMTP_USER !== 'string' || typeof config.SMTP_PASSWORD !== 'string' || typeof config.EMAIL_FROM !== 'string' || typeof config.AUTH_OTP_PEPPER !== 'string') {
    throw new Error('SMTP and auth OTP settings must be strings');
  }
  const smtpSecure = config.SMTP_SECURE ?? 'false';
  if (smtpSecure !== 'true' && smtpSecure !== 'false') throw new Error('SMTP_SECURE must be true or false');
  config.SMTP_SECURE = smtpSecure === 'true';
  if (Boolean(config.SMTP_HOST) !== Boolean(config.EMAIL_FROM)) {
    throw new Error('SMTP_HOST and EMAIL_FROM must be configured together');
  }
  if (Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASSWORD)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
  }
  if (config.SMTP_HOST && (config.AUTH_OTP_PEPPER as string).length < 32) {
    throw new Error('AUTH_OTP_PEPPER must contain at least 32 characters when SMTP is configured');
  }
  if (Number(config.AUTH_REFRESH_TTL_MS) <= Number(config.AUTH_ACCESS_TTL_MS)) {
    throw new Error('AUTH_REFRESH_TTL_MS must exceed AUTH_ACCESS_TTL_MS');
  }
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
  config.FRONTEND_ORIGIN ??= 'http://localhost:5173';
  validateHttpOrigin(config, 'FRONTEND_ORIGIN');

  const googleKeys = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
  ];
  if (
    googleKeys.some(
      (key) => typeof config[key] === 'string' && config[key].trim(),
    )
  ) {
    for (const key of googleKeys) {
      if (typeof config[key] !== 'string' || !config[key].trim()) {
        throw new Error(`${key} is required when Google login is configured`);
      }
    }
    validateHttpUrl(config, 'GOOGLE_REDIRECT_URI');
  }

  config.SEPAY_V2_BASE_URL ??= 'https://userapi-sandbox.sepay.vn/v2';
  validateHttpUrl(config, 'SEPAY_V2_BASE_URL');
  const sepayBaseUrl = new URL(config.SEPAY_V2_BASE_URL as string);
  if (sepayBaseUrl.protocol !== 'https:' || sepayBaseUrl.origin !== 'https://userapi-sandbox.sepay.vn' || sepayBaseUrl.pathname !== '/v2') {
    throw new Error('SEPAY_V2_BASE_URL must use https://userapi-sandbox.sepay.vn/v2 in test mode');
  }
  for (const key of ['SEPAY_V2_API_TOKEN', 'SEPAY_V2_BANK_ACCOUNT_XID', 'SEPAY_V2_TERMINAL_ID', 'SEPAY_WEBHOOK_SECRET', 'SEPAY_WEBHOOK_API_KEY']) {
    config[key] ??= '';
    if (typeof config[key] !== 'string') throw new Error(`${key} must be a string`);
  }
  if (Boolean(config.SEPAY_V2_API_TOKEN) !== Boolean(config.SEPAY_V2_BANK_ACCOUNT_XID)) {
    throw new Error('SEPAY_V2_API_TOKEN and SEPAY_V2_BANK_ACCOUNT_XID must be configured together');
  }
  if (config.SEPAY_V2_BANK_ACCOUNT_XID && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.SEPAY_V2_BANK_ACCOUNT_XID as string)) {
    throw new Error('SEPAY_V2_BANK_ACCOUNT_XID must be a UUID');
  }
  config.SEPAY_WEBHOOK_AUTH_TYPE ??= 'HMAC_SHA256';
  if (!['HMAC_SHA256', 'API_KEY'].includes(config.SEPAY_WEBHOOK_AUTH_TYPE as string)) {
    throw new Error('SEPAY_WEBHOOK_AUTH_TYPE must be HMAC_SHA256 or API_KEY');
  }
  return config;
}

function validateHttpOrigin(
  config: Record<string, unknown>,
  key: string,
): void {
  validateHttpUrl(config, key);
  const value = config[key] as string;
  if (new URL(value).origin !== value) {
    throw new Error(`${key} must be an HTTP origin without a path`);
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
