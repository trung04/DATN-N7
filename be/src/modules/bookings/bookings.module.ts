import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancellationPoliciesModule } from '../cancellation-policies/cancellation-policies.module';
import { RoomsModule } from '../rooms/rooms.module';
import { HotelsModule } from '../hotels/hotels.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './controllers/bookings.controller';
import { AdminBookingSettingsController } from './controllers/admin-booking-settings.controller';
import { SettlementsController } from './controllers/settlements.controller';
import { PayosGatewayClient } from './integrations/payos/payos.gateway';
import { PAYOS_GATEWAY } from './interfaces/payos-gateway.interface';
import { PayosWebhookController } from './controllers/payos-webhook.controller';
import { BookingEntity } from './entities/booking.entity';
import { BookingSettingsEntity } from './entities/booking-settings.entity';
import { BookingIdempotencyKeyEntity } from './entities/booking-idempotency-key.entity';
import { BookingRoomEntity } from './entities/booking-room.entity';
import { BookingRoomChildEntity } from './entities/booking-room-child.entity';
import { SettlementBatchEntity } from './entities/settlement-batch.entity';
import { SettlementItemEntity } from './entities/settlement-item.entity';
import { SettlementBatchEventEntity } from './entities/settlement-batch-event.entity';
import { RandomBookingCodeGenerator } from './integrations/code/random-booking-code.generator';
import { BOOKING_CODE_GENERATOR } from './interfaces/booking-code-generator.interface';
import { BOOKING_REPOSITORY } from './interfaces/booking.repository.interface';
import { BOOKING_SETTINGS_REPOSITORY } from './interfaces/booking-settings.repository.interface';
import { TypeOrmBookingRepository } from './repositories/typeorm-booking.repository';
import { TypeOrmBookingSettingsRepository } from './repositories/typeorm-booking-settings.repository';
import { TypeOrmSettlementRepository } from './repositories/typeorm-settlement.repository';
import { BookingsService } from './services/bookings.service';
import { BookingSettingsService } from './services/booking-settings.service';
import { SettlementsService } from './services/settlements.service';
import { SETTLEMENT_REPOSITORY } from './interfaces/settlement.repository.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BookingEntity,
      BookingSettingsEntity,
      BookingRoomEntity,
      BookingRoomChildEntity,
      BookingIdempotencyKeyEntity,
      SettlementBatchEntity,
      SettlementItemEntity,
      SettlementBatchEventEntity,
    ]),
    CancellationPoliciesModule,
    RoomsModule,
    HotelsModule,
    NotificationsModule,
  ],
  controllers: [BookingsController, AdminBookingSettingsController, SettlementsController, PayosWebhookController],
  providers: [
    BookingsService,
    BookingSettingsService,
    { provide: BOOKING_SETTINGS_REPOSITORY, useClass: TypeOrmBookingSettingsRepository },
    { provide: PAYOS_GATEWAY, useClass: PayosGatewayClient },
    SettlementsService,
    { provide: SETTLEMENT_REPOSITORY, useClass: TypeOrmSettlementRepository },
    {
      provide: BOOKING_REPOSITORY,
      useClass: TypeOrmBookingRepository,
    },
    {
      provide: BOOKING_CODE_GENERATOR,
      useClass: RandomBookingCodeGenerator,
    },
  ],
})
export class BookingsModule {}
