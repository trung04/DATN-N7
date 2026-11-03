import { Logger, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL('redis://localhost');
        url.protocol = config.get<boolean>('REDIS_TLS') ? 'rediss:' : 'redis:';
        url.hostname = config.getOrThrow<string>('REDIS_HOST');
        url.port = String(config.getOrThrow<number>('REDIS_PORT'));
        url.pathname = `/${config.getOrThrow<number>('REDIS_DB')}`;
        url.username = config.get<string>('REDIS_USERNAME', '');
        url.password = config.get<string>('REDIS_PASSWORD', '');
        const store = createKeyv(url.toString(), {
          namespace: 'tourism:cache',
          connectionTimeout: config.getOrThrow<number>(
            'REDIS_CONNECT_TIMEOUT_MS',
          ),
        });
        const logger = new Logger('RedisCache');
        store.on('error', () =>
          logger.error('Redis cache connection or operation failed'),
        );
        return {
          stores: [store],
          ttl: config.getOrThrow<number>('CACHE_TTL_MS'),
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class RedisCacheModule {}
