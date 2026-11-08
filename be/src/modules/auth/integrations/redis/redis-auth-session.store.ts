import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from 'redis';
import type {
  AccessSession,
  AuthSessionStore,
  RefreshSessionResult,
  SessionTokens,
} from '../../interfaces/auth-session-store.interface';

interface StoredSession {
  userId: string;
  familyId: string;
}

interface StoredFamily extends StoredSession {
  accessHash: string;
  refreshHash: string;
}

const VALIDATE_ACCESS_SCRIPT = `
local access = redis.call('GET', KEYS[1])
if not access then return {} end
local session = cjson.decode(access)
local family = redis.call('GET', ARGV[1] .. session.familyId)
if not family then return {} end
local familyData = cjson.decode(family)
if familyData.accessHash ~= ARGV[2] then return {} end
return {session.userId, session.familyId}
`;

const ROTATE_REFRESH_SCRIPT = `
local refresh = redis.call('GET', KEYS[1])
if not refresh then
  local reusedFamilyId = redis.call('GET', KEYS[2])
  if not reusedFamilyId then return {'invalid'} end
  local reusedFamilyKey = ARGV[1] .. reusedFamilyId
  local reusedFamily = redis.call('GET', reusedFamilyKey)
  if reusedFamily then
    local reusedFamilyData = cjson.decode(reusedFamily)
    redis.call('DEL', ARGV[2] .. reusedFamilyData.accessHash)
    redis.call('DEL', ARGV[3] .. reusedFamilyData.refreshHash)
    redis.call('DEL', reusedFamilyKey)
  end
  return {'reused'}
end

local session = cjson.decode(refresh)
local familyKey = ARGV[1] .. session.familyId
local family = redis.call('GET', familyKey)
if not family then
  redis.call('DEL', KEYS[1])
  return {'invalid'}
end

local familyData = cjson.decode(family)
if familyData.refreshHash ~= ARGV[4] then return {'invalid'} end
local familyTtl = redis.call('PTTL', familyKey)
if familyTtl <= 0 then return {'invalid'} end
local accessTtl = math.min(tonumber(ARGV[7]), familyTtl)

redis.call('DEL', ARGV[2] .. familyData.accessHash)
redis.call('DEL', KEYS[1])
redis.call('SET', KEYS[2], session.familyId, 'PX', familyTtl)
redis.call('SET', ARGV[2] .. ARGV[5], cjson.encode(session), 'PX', accessTtl)
redis.call('SET', ARGV[3] .. ARGV[6], cjson.encode(session), 'PX', familyTtl)
familyData.accessHash = ARGV[5]
familyData.refreshHash = ARGV[6]
redis.call('SET', familyKey, cjson.encode(familyData), 'PX', familyTtl)

return {'rotated', session.userId, session.familyId, tostring(accessTtl), tostring(familyTtl)}
`;

const REVOKE_FAMILY_SCRIPT = `
local family = redis.call('GET', KEYS[1])
if not family then return 0 end
local familyData = cjson.decode(family)
redis.call('DEL', ARGV[1] .. familyData.accessHash)
redis.call('DEL', ARGV[2] .. familyData.refreshHash)
redis.call('DEL', KEYS[1])
return 1
`;

@Injectable()
export class RedisAuthSessionStore
  implements AuthSessionStore, OnModuleDestroy
{
  private readonly logger = new Logger(RedisAuthSessionStore.name);
  private readonly prefix = 'tourism:auth:';
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
      this.logger.error('Redis authentication session operation failed'),
    );
  }

  async create(userId: string): Promise<SessionTokens> {
    const client = await this.getClient();
    const familyId = this.randomToken();
    const accessToken = this.randomToken();
    const refreshToken = this.randomToken();
    const accessHash = this.hash(accessToken);
    const refreshHash = this.hash(refreshToken);
    const accessExpiresInMs =
      this.config.getOrThrow<number>('AUTH_ACCESS_TTL_MS');
    const refreshExpiresInMs = this.config.getOrThrow<number>(
      'AUTH_REFRESH_TTL_MS',
    );
    const session: StoredSession = { userId, familyId };
    const family: StoredFamily = {
      ...session,
      accessHash,
      refreshHash,
    };

    await client
      .multi()
      .set(this.accessKey(accessHash), JSON.stringify(session), {
        PX: accessExpiresInMs,
      })
      .set(this.refreshKey(refreshHash), JSON.stringify(session), {
        PX: refreshExpiresInMs,
      })
      .set(this.familyKey(familyId), JSON.stringify(family), {
        PX: refreshExpiresInMs,
      })
      .exec();

    return {
      accessToken,
      refreshToken,
      accessExpiresInMs,
      refreshExpiresInMs,
    };
  }

  async validateAccess(accessToken: string): Promise<AccessSession | null> {
    const client = await this.getClient();
    const accessHash = this.hash(accessToken);
    const result = (await client.eval(VALIDATE_ACCESS_SCRIPT, {
      keys: [this.accessKey(accessHash)],
      arguments: [this.familyPrefix(), accessHash],
    })) as string[];
    if (result.length !== 2) return null;
    return { userId: result[0], familyId: result[1] };
  }

  async rotate(refreshToken: string): Promise<RefreshSessionResult> {
    const client = await this.getClient();
    const oldRefreshHash = this.hash(refreshToken);
    const accessToken = this.randomToken();
    const nextRefreshToken = this.randomToken();
    const accessHash = this.hash(accessToken);
    const refreshHash = this.hash(nextRefreshToken);
    const accessTtl = this.config.getOrThrow<number>('AUTH_ACCESS_TTL_MS');
    const result = (await client.eval(ROTATE_REFRESH_SCRIPT, {
      keys: [
        this.refreshKey(oldRefreshHash),
        this.usedRefreshKey(oldRefreshHash),
      ],
      arguments: [
        this.familyPrefix(),
        this.accessPrefix(),
        this.refreshPrefix(),
        oldRefreshHash,
        accessHash,
        refreshHash,
        String(accessTtl),
      ],
    })) as string[];

    if (result[0] !== 'rotated') {
      return { status: result[0] === 'reused' ? 'reused' : 'invalid' };
    }
    return {
      status: 'rotated',
      userId: result[1],
      familyId: result[2],
      accessToken,
      refreshToken: nextRefreshToken,
      accessExpiresInMs: Number(result[3]),
      refreshExpiresInMs: Number(result[4]),
    };
  }

  async revokeByTokens(
    accessToken?: string,
    refreshToken?: string,
  ): Promise<void> {
    const client = await this.getClient();
    if (refreshToken) {
      const hash = this.hash(refreshToken);
      const raw = await client.get(this.refreshKey(hash));
      const familyId = raw
        ? this.parseSession(raw).familyId
        : await client.get(this.usedRefreshKey(hash));
      if (familyId) {
        await this.revokeFamily(familyId);
        return;
      }
    }
    if (accessToken) {
      const raw = await client.get(this.accessKey(this.hash(accessToken)));
      if (raw) await this.revokeFamily(this.parseSession(raw).familyId);
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    const client = await this.getClient();
    await client.eval(REVOKE_FAMILY_SCRIPT, {
      keys: [this.familyKey(familyId)],
      arguments: [this.accessPrefix(), this.refreshPrefix()],
    });
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

  private parseSession(raw: string): StoredSession {
    return JSON.parse(raw) as StoredSession;
  }

  private randomToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private accessPrefix(): string {
    return `${this.prefix}access:`;
  }

  private refreshPrefix(): string {
    return `${this.prefix}refresh:`;
  }

  private familyPrefix(): string {
    return `${this.prefix}family:`;
  }

  private accessKey(hash: string): string {
    return `${this.accessPrefix()}${hash}`;
  }

  private refreshKey(hash: string): string {
    return `${this.refreshPrefix()}${hash}`;
  }

  private usedRefreshKey(hash: string): string {
    return `${this.prefix}refresh-used:${hash}`;
  }

  private familyKey(familyId: string): string {
    return `${this.familyPrefix()}${familyId}`;
  }
}
