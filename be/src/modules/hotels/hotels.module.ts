import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelOwnersModule } from '../hotel-owners/hotel-owners.module';
import { PlacesModule } from '../places/places.module';
import { UsersModule } from '../users/users.module';
import { AdminHotelsController } from './controllers/admin-hotels.controller';
import { HotelsController } from './controllers/hotels.controller';
import { HotelDocumentEntity } from './entities/hotel-document.entity';
import { HotelReviewHistoryEntity } from './entities/hotel-review-history.entity';
import { HotelEntity } from './entities/hotel.entity';
import { HOTEL_REPOSITORY } from './interfaces/hotel.repository.interface';
import { TypeOrmHotelRepository } from './repositories/typeorm-hotel.repository';
import { HotelsService } from './services/hotels.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HotelEntity,
      HotelDocumentEntity,
      HotelReviewHistoryEntity,
    ]),
    HotelOwnersModule,
    PlacesModule,
    UsersModule,
  ],
  controllers: [HotelsController, AdminHotelsController],
  providers: [
    HotelsService,
    {
      provide: HOTEL_REPOSITORY,
      useClass: TypeOrmHotelRepository,
    },
  ],
  exports: [HotelsService],
})
export class HotelsModule {}
