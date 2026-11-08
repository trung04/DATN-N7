import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancellationPoliciesModule } from '../cancellation-policies/cancellation-policies.module';
import { RoomsModule } from '../rooms/rooms.module';
import { BookingsController } from './controllers/bookings.controller';
import { VnpayCallbacksController } from './controllers/vnpay-callbacks.controller';
import { BookingEntity } from './entities/booking.entity';
import { BookingIdempotencyKeyEntity } from './entities/booking-idempotency-key.entity';
import { BookingRoomEntity } from './entities/booking-room.entity';
import { RandomBookingCodeGenerator } from './integrations/code/random-booking-code.generator';
import { SandboxVnpayGateway } from './integrations/vnpay/sandbox-vnpay.gateway';
import { BOOKING_CODE_GENERATOR } from './interfaces/booking-code-generator.interface';
import { BOOKING_REPOSITORY } from './interfaces/booking.repository.interface';
import { VNPAY_PAYMENT_GATEWAY } from './interfaces/vnpay-payment-gateway.interface';
import { TypeOrmBookingRepository } from './repositories/typeorm-booking.repository';
import { BookingsService } from './services/bookings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BookingEntity,
      BookingRoomEntity,
      BookingIdempotencyKeyEntity,
    ]),
    CancellationPoliciesModule,
    RoomsModule,
  ],
  controllers: [BookingsController, VnpayCallbacksController],
  providers: [
    BookingsService,
    {
      provide: BOOKING_REPOSITORY,
      useClass: TypeOrmBookingRepository,
    },
    {
      provide: BOOKING_CODE_GENERATOR,
      useClass: RandomBookingCodeGenerator,
    },
    {
      provide: VNPAY_PAYMENT_GATEWAY,
      useClass: SandboxVnpayGateway,
    },
  ],
})
export class BookingsModule {}
