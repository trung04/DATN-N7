import { ConfigService } from '@nestjs/config';
import { RedisAuthStore } from './redis-auth.store';

describe('RedisAuthStore', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const familyId = 'family-id';
  let multi: { set: jest.Mock; exec: jest.Mock };
  let client: {
    isOpen: boolean;
    on: jest.Mock;
    multi: jest.Mock;
    set: jest.Mock;
    get: jest.Mock;
    eval: jest.Mock;
    close: jest.Mock;
  };
  let store: RedisAuthStore;

  beforeEach(() => {
    multi = {
      set: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    client = {
      isOpen: true,
      on: jest.fn(),
      multi: jest.fn().mockReturnValue(multi),
      set: jest.fn(),
      get: jest.fn(),
      eval: jest.fn(),
      close: jest.fn(),
    };
    store = new RedisAuthStore(
      new ConfigService({
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_DB: 0,
        REDIS_CONNECT_TIMEOUT_MS: 5000,
        AUTH_ACCESS_TTL_MS: 60000,
        AUTH_REFRESH_TTL_MS: 120000,
      }),
    );
    Object.defineProperty(store, 'client', { value: client });
  });

  it('stores only hashes of opaque session tokens', async () => {
    const result = await store.create(userId);

    expect(result.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = JSON.stringify(multi.set.mock.calls);
    expect(stored).not.toContain(result.accessToken);
    expect(stored).not.toContain(result.refreshToken);
    expect(stored).toContain('tourism:auth:access:');
    expect(stored).toContain('tourism:auth:refresh:');
  });

  it('returns a new token pair only after atomic rotation', async () => {
    client.eval.mockResolvedValueOnce([
      'rotated',
      userId,
      familyId,
      '60000',
      '120000',
    ]);

    const result = await store.rotate('old-refresh');

    expect(result).toMatchObject({
      status: 'rotated',
      userId,
      familyId,
      accessExpiresInMs: 60000,
      refreshExpiresInMs: 120000,
    });
    client.eval.mockResolvedValueOnce(['reused']);
    await expect(store.rotate('used-refresh')).resolves.toEqual({
      status: 'reused',
    });
  });

  it('stores a hashed Google state and consumes it once', async () => {
    const context = {
      codeVerifier: 'verifier',
      nonce: 'nonce',
      returnTo: '/trips',
    };
    await store.save('raw-state', context, 600000);

    expect(client.set.mock.calls[0][0]).toMatch(
      /^tourism:auth:google-state:[a-f0-9]{64}$/,
    );
    expect(client.set.mock.calls[0][0]).not.toContain('raw-state');
    client.eval.mockResolvedValueOnce(JSON.stringify(context));
    await expect(store.consume('raw-state')).resolves.toEqual(context);

    client.eval.mockResolvedValueOnce(null);
    await expect(store.consume('raw-state')).resolves.toBeNull();
  });
});
