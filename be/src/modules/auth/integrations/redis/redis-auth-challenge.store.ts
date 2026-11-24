import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import type {
  AuthChallengePurpose,
  AuthChallengeStore,
  ChallengeConsumeResult,
} from '../../interfaces/auth-challenge-store.interface';

interface StoredChallenge {
  codeHash: string;
  attempts: number;
}

const ISSUE_SCRIPT = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
return 1
`;

const CONSUME_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'expired' end
local challenge = cjson.decode(raw)
if tonumber(challenge.attempts) >= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1])
  return 'locked'
end
if challenge.codeHash == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2])
  return 'valid'
end
challenge.attempts = tonumber(challenge.attempts) + 1
local ttl = redis.call('PTTL', KEYS[1])
if challenge.attempts >= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1])
  return 'locked'
end
if ttl > 0 then redis.call('SET', KEYS[1], cjson.encode(challenge), 'PX', ttl) end
return 'invalid'
`;

@Injectable()
export class RedisAuthChallengeStore implements AuthChallengeStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisAuthChallengeStore.name);
  private readonly prefix = 'tourism:auth:challenge:';
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
      socket: { connectTimeout: config.getOrThrow<number>('REDIS_CONNECT_TIMEOUT_MS') },
    });
    this.client.on('error', () => this.logger.error('Redis auth challenge operation failed'));
  }

  async issue(email: string, purpose: AuthChallengePurpose, codeHash: string, ttlMs: number, cooldownMs: number): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.eval(ISSUE_SCRIPT, {
      keys: [this.challengeKey(email, purpose), this.cooldownKey(email, purpose)],
      arguments: [JSON.stringify({ codeHash, attempts: 0 } satisfies StoredChallenge), String(ttlMs), String(cooldownMs)],
    });
    return Number(result) === 1;
  }

  async consume(email: string, purpose: AuthChallengePurpose, codeHash: string): Promise<ChallengeConsumeResult> {
    const client = await this.getClient();
    const result = await client.eval(CONSUME_SCRIPT, {
      keys: [this.challengeKey(email, purpose), this.cooldownKey(email, purpose)],
      arguments: [codeHash, '5'],
    });
    return result as ChallengeConsumeResult;
  }

  async clear(email: string, purpose: AuthChallengePurpose): Promise<void> {
    const client = await this.getClient();
    await client.del([this.challengeKey(email, purpose), this.cooldownKey(email, purpose)]);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) await this.client.close();
  }

  private async getClient(): Promise<typeof this.client> {
    if (!this.client.isOpen) {
      this.connection ??= this.client.connect().finally(() => { this.connection = undefined; });
      await this.connection;
    }
    return this.client;
  }

  private emailHash(email: string): string {
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  private challengeKey(email: string, purpose: AuthChallengePurpose): string {
    return `${this.prefix}${purpose}:${this.emailHash(email)}`;
  }

  private cooldownKey(email: string, purpose: AuthChallengePurpose): string {
    return `${this.prefix}cooldown:${purpose}:${this.emailHash(email)}`;
  }
}
