import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from 'redis';
import type {
  TwoFactorLoginChallenge,
  TwoFactorLoginChallengeStore,
} from '../../interfaces/two-factor-login-challenge-store.interface';

interface StoredChallenge extends TwoFactorLoginChallenge {
  attemptsRemaining: number;
}

const TAKE_ATTEMPT_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {} end
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return {} end
local challenge = cjson.decode(raw)
challenge.attemptsRemaining = challenge.attemptsRemaining - 1
if challenge.attemptsRemaining <= 0 then
  redis.call('DEL', KEYS[1])
else
  redis.call('SET', KEYS[1], cjson.encode(challenge), 'PX', ttl, 'XX')
end
return {challenge.userId, challenge.returnTo}
`;

@Injectable()
export class RedisTwoFactorLoginChallengeStore
  implements TwoFactorLoginChallengeStore, OnModuleDestroy
{
  private readonly logger = new Logger(
    RedisTwoFactorLoginChallengeStore.name,
  );
  private readonly prefix = 'tourism:auth:two-factor-login:';
  private readonly client;
  private connection?: Promise<unknown>;

  constructor(private readonly config: ConfigService) {
    const url = new URL('redis://localhost');
    url.protocol = config.get<boolean>('REDIS_TLS') ? 'rediss:' : 'redis:';
    url.hostname = config.getOrThrow<string>('REDIS_HOST');
    url.port = String(config.getOrThrow<number>('REDIS_PORT'));
    url.pathname = `/${config.getOrThrow<number>('REDIS_DB')}`;
    url.username = config.get<string>('REDIS_USERNAME', '');
    url.password = config.get<string>('REDIS_PASSWORD', '');
    this.client = createClient({
      url: url.toString(),
      socket: {
        connectTimeout: config.getOrThrow<number>('REDIS_CONNECT_TIMEOUT_MS'),
      },
    });
    this.client.on('error', () =>
      this.logger.error('Redis two-factor challenge operation failed'),
    );
  }

  async create(
    userId: string,
    returnTo: string,
    ttlMs: number,
  ): Promise<string> {
    const client = await this.getClient();
    const token = randomBytes(32).toString('base64url');
    const challenge: StoredChallenge = {
      userId,
      returnTo,
      attemptsRemaining: 5,
    };
    await client.set(this.key(token), JSON.stringify(challenge), {
      PX: ttlMs,
      NX: true,
    });
    return token;
  }

  async takeAttempt(token: string): Promise<TwoFactorLoginChallenge | null> {
    const client = await this.getClient();
    const result = (await client.eval(TAKE_ATTEMPT_SCRIPT, {
      keys: [this.key(token)],
      arguments: [],
    })) as string[];
    return result.length === 2
      ? { userId: result[0], returnTo: result[1] }
      : null;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) await this.client.close();
  }

  private async getClient(): Promise<typeof this.client> {
    if (!this.client.isOpen) {
      this.connection ??= this.client.connect().finally(() => {
        this.connection = undefined;
      });
      await this.connection;
    }
    return this.client;
  }

  private key(token: string): string {
    const hash = createHash('sha256').update(token).digest('hex');
    return `${this.prefix}${hash}`;
  }
}
