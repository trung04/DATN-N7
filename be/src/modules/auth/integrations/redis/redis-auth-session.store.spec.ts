import { ConfigService } from '@nestjs/config';
import { RedisAuthSessionStore } from './redis-auth-session.store';

describe('RedisAuthSessionStore', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const familyId = 'family-id';
  let multi: { set: jest.Mock; exec: jest.Mock };
  let client: {
    isOpen: boolean;
    on: jest.Mock;
    multi: jest.Mock;
    get: jest.Mock;
    eval: jest.Mock;
    close: jest.Mock;
  };
  let store: RedisAuthSessionStore;

  beforeEach(() => {
    multi = {
      set: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    client = {
      isOpen: true,
      on: jest.fn(),
      multi: jest.fn().mockReturnValue(multi),
      get: jest.fn(),
      eval: jest.fn(),
      close: jest.fn(),
    };
    const values: Record<string, unknown> = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_DB: 0,
      REDIS_CONNECT_TIMEOUT_MS: 5000,
      AUTH_ACCESS_TTL_MS: 60000,
      AUTH_REFRESH_TTL_MS: 120000,
    };
    store = new RedisAuthSessionStore(new ConfigService(values));
    Object.defineProperty(store, 'client', { value: client });
  });

  it('stores only token hashes and returns the raw tokens to the caller', async () => {
    const result = await store.create(userId);

    expect(result.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(multi.set).toHaveBeenCalledTimes(3);
    const stored = JSON.stringify(multi.set.mock.calls);
    expect(stored).not.toContain(result.accessToken);
    expect(stored).not.toContain(result.refreshToken);
    expect(stored).toContain('tourism:auth:access:');
    expect(stored).toContain('tourism:auth:refresh:');
  });

  it('validates access only when Redis confirms the current family token', async () => {
    client.eval.mockResolvedValueOnce([userId, familyId]);
    await expect(store.validateAccess('access-token')).resolves.toEqual({
      userId,
      familyId,
    });

    client.eval.mockResolvedValueOnce([]);
    await expect(store.validateAccess('expired-token')).resolves.toBeNull();
  });

  it('returns a new token pair after atomic refresh rotation', async () => {
    client.eval.mockResolvedValueOnce([
      'rotated',
      userId,
      familyId,
      '60000',
      '120000',
    ]);

    const result = await store.rotate('old-refresh-token');

    expect(result).toMatchObject({
      status: 'rotated',
      userId,
      familyId,
      accessExpiresInMs: 60000,
      refreshExpiresInMs: 120000,
    });
    if (result.status === 'rotated') {
      expect(result.refreshToken).not.toBe('old-refresh-token');
    }
  });

  it.each(['invalid', 'reused'] as const)(
    'does not issue tokens for a %s refresh result',
    async (status) => {
      client.eval.mockResolvedValueOnce([status]);
      await expect(store.rotate('refresh-token')).resolves.toEqual({ status });
    },
  );

  it('revokes a family located from a refresh token', async () => {
    client.get.mockResolvedValueOnce(JSON.stringify({ userId, familyId }));
    client.eval.mockResolvedValueOnce(1);

    await store.revokeByTokens(undefined, 'refresh-token');

    expect(client.eval).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        keys: [`tourism:auth:family:${familyId}`],
      }),
    );
  });
});
