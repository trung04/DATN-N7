import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelsModule } from '../hotels/hotels.module';
import { BookingEntity } from '../bookings/entities/booking.entity';
import { HotelEntity } from '../hotels/entities/hotel.entity';
import { UserEntity } from '../users/entities/user.entity';
import { BookingReviewsController } from './controllers/booking-reviews.controller';
import { ReviewsController } from './controllers/reviews.controller';
import { ReviewModerationHistoryEntity } from './entities/review-moderation-history.entity';
import { ReviewEntity } from './entities/review.entity';
import { ReviewsService } from './services/reviews.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReviewEntity,
      ReviewModerationHistoryEntity,
      BookingEntity,
      HotelEntity,
      UserEntity,
    ]),
    HotelsModule,
  ],
  controllers: [ReviewsController, BookingReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
