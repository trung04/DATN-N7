import { ConfigService } from '@nestjs/config';
import { RedisTwoFactorLoginChallengeStore } from './redis-two-factor-login-challenge.store';

describe('RedisTwoFactorLoginChallengeStore', () => {
  const config = new ConfigService({
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_DB: 0,
    REDIS_TLS: false,
    REDIS_CONNECT_TIMEOUT_MS: 1000,
  });

  it('creates opaque challenge tokens and records at most five attempts', async () => {
    const store = new RedisTwoFactorLoginChallengeStore(config);
    const client = {
      set: jest.fn(),
      eval: jest.fn().mockResolvedValue([
        '11111111-1111-4111-8111-111111111111',
        '/trips',
      ]),
    };
    (store as unknown as { getClient(): Promise<unknown> }).getClient = jest
      .fn()
      .mockResolvedValue(client);

    const token = await store.create(
      '11111111-1111-4111-8111-111111111111',
      '/trips',
      300_000,
    );
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(client.set).toHaveBeenCalledWith(
      expect.stringContaining('two-factor-login:'),
      JSON.stringify({
        userId: '11111111-1111-4111-8111-111111111111',
        returnTo: '/trips',
        attemptsRemaining: 5,
      }),
      { PX: 300_000, NX: true },
    );

    await expect(store.takeAttempt(token)).resolves.toEqual({
      userId: '11111111-1111-4111-8111-111111111111',
      returnTo: '/trips',
    });
  });
});
