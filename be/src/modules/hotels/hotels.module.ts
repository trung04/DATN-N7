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
import { HotelImageEntity } from './entities/hotel-image.entity';
import { HotelImagesController } from './controllers/hotel-images.controller';
import { HotelImagesService } from './services/hotel-images.service';
import { HotelImageManagementGuard } from './guards/hotel-image-management.guard';
import { HOTEL_IMAGE_REPOSITORY } from './interfaces/hotel-image.repository.interface';
import { HOTEL_IMAGE_STORAGE } from './interfaces/hotel-image-storage.interface';
import { TypeOrmHotelImageRepository } from './repositories/typeorm-hotel-image.repository';
import { S3HotelImageStorage } from './integrations/s3-hotel-image.storage';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HotelEntity,
      HotelImageEntity,
      HotelDocumentEntity,
      HotelReviewHistoryEntity,
    ]),
    HotelOwnersModule,
    PlacesModule,
    UsersModule,
  ],
  controllers: [HotelsController, AdminHotelsController, HotelImagesController],
  providers: [
    HotelsService,
    HotelImagesService,
    HotelImageManagementGuard,
    { provide: HOTEL_IMAGE_REPOSITORY, useClass: TypeOrmHotelImageRepository },
    { provide: HOTEL_IMAGE_STORAGE, useClass: S3HotelImageStorage },
    {
      provide: HOTEL_REPOSITORY,
      useClass: TypeOrmHotelRepository,
    },
  ],
  exports: [HotelsService],
})
export class HotelsModule {}
