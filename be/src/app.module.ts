import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { StarterModule } from './modules/app/app.module';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.validation';
import { DatabaseModule } from './database/database.module';
import { RedisCacheModule } from './common/cache/redis-cache.module';
import { AmenitiesModule } from './modules/amenities/amenities.module';
import { APP_FILTER } from '@nestjs/core';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { RoomsModule } from './modules/rooms/rooms.module';
import { UsersModule } from './modules/users/users.module';
import { HotelOwnersModule } from './modules/hotel-owners/hotel-owners.module';
import { PlacesModule } from './modules/places/places.module';
import { CancellationPoliciesModule } from './modules/cancellation-policies/cancellation-policies.module';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RedisCacheModule,
    StarterModule,
    AmenitiesModule,
    RoomsModule,
    UsersModule,
    HotelOwnersModule,
    PlacesModule,
    CancellationPoliciesModule,
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'be',
    }),
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ProblemDetailsFilter,
    },
  ],
})
export class AppModule {}
