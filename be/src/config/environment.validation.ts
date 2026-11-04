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
  integer('AI_TIMEOUT_MS', 15000, 1, 120000);
  config.AI_BASE_URL ??= 'http://localhost:9000';
  try {
    const url = new URL(String(config.AI_BASE_URL));
    if (
      typeof config.AI_BASE_URL !== 'string' ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/'
    ) throw new Error('invalid');
    config.AI_BASE_URL = url.origin;
  } catch {
    throw new Error('AI_BASE_URL must be an HTTP(S) origin without credentials');
  }
  config.AI_API_KEY ??= '';
  if (typeof config.AI_API_KEY !== 'string') throw new Error('AI_API_KEY must be a string');
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
  return config;
}
