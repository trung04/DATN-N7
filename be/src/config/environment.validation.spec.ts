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
    expect(result.DATABASE_PASSWORD).toBe(database.DATABASE_PASSWORD);
  });

  it.each([
    ['DATABASE_PORT', '5432abc'],
    ['REDIS_PORT', '65536'],
    ['DATABASE_POOL_SIZE', '0'],
    ['CACHE_TTL_MS', '-1'],
    ['REDIS_DB', '1.5'],
    ['REDIS_TLS', 'yes'],
    ['DATABASE_SSL', '1'],
    ['REDIS_HOST', ''],
    ['DATABASE_PASSWORD', ''],
  ])('rejects invalid %s', (key, value) => {
    expect(() => validateEnvironment({ ...database, [key]: value })).toThrow(
      key,
    );
  });

  it('fails on missing database credentials', () => {
    expect(() => validateEnvironment({})).toThrow('DATABASE_HOST is required');
  });
});
