import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DATABASE_HOST'),
        port: config.getOrThrow<number>('DATABASE_PORT'),
        username: config.getOrThrow<string>('DATABASE_USER'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.getOrThrow<string>('DATABASE_NAME'),
        ssl: config.get<boolean>('DATABASE_SSL')
          ? { rejectUnauthorized: true }
          : false,
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
        logging: false,
        poolSize: config.getOrThrow<number>('DATABASE_POOL_SIZE'),
        connectTimeoutMS: config.getOrThrow<number>(
          'DATABASE_CONNECT_TIMEOUT_MS',
        ),
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    }),
  ],
})
export class DatabaseModule {}
