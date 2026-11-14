import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancellationPoliciesModule } from '../cancellation-policies/cancellation-policies.module';
import { RoomsModule } from '../rooms/rooms.module';
import { HotelsModule } from '../hotels/hotels.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './controllers/bookings.controller';
import { SettlementsController } from './controllers/settlements.controller';
import { SePayCallbacksController } from './controllers/sepay-callbacks.controller';
import { BookingEntity } from './entities/booking.entity';
import { BookingIdempotencyKeyEntity } from './entities/booking-idempotency-key.entity';
import { BookingRoomEntity } from './entities/booking-room.entity';
import { SettlementBatchEntity } from './entities/settlement-batch.entity';
import { SettlementItemEntity } from './entities/settlement-item.entity';
import { SettlementBatchEventEntity } from './entities/settlement-batch-event.entity';
import { RandomBookingCodeGenerator } from './integrations/code/random-booking-code.generator';
import { SePayV2ClientImpl } from './integrations/sepay/sepay-v2.client';
import { BOOKING_CODE_GENERATOR } from './interfaces/booking-code-generator.interface';
import { BOOKING_REPOSITORY } from './interfaces/booking.repository.interface';
import { SEPAY_V2_CLIENT } from './interfaces/sepay-v2.interface';
import { TypeOrmBookingRepository } from './repositories/typeorm-booking.repository';
import { TypeOrmSettlementRepository } from './repositories/typeorm-settlement.repository';
import { BookingsService } from './services/bookings.service';
import { SettlementsService } from './services/settlements.service';
import { SETTLEMENT_REPOSITORY } from './interfaces/settlement.repository.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BookingEntity,
      BookingRoomEntity,
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
  controllers: [BookingsController, SePayCallbacksController, SettlementsController],
  providers: [
    BookingsService,
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
    {
      provide: SEPAY_V2_CLIENT,
      useClass: SePayV2ClientImpl,
    },
  ],
})
export class BookingsModule {}
