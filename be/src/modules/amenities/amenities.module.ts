import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelsModule } from '../hotels/hotels.module';
import { RoomAmenityEntity } from '../rooms/entities/room-amenity.entity';
import { AmenitiesController } from './controllers/amenities.controller';
import { HotelAmenitiesController } from './controllers/hotel-amenities.controller';
import { AmenityEntity } from './entities/amenity.entity';
import { AMENITY_REPOSITORY } from './interfaces/amenity.repository.interface';
import { TypeOrmAmenityRepository } from './repositories/typeorm-amenity.repository';
import { AmenitiesService } from './services/amenities.service';

@Module({
  imports: [TypeOrmModule.forFeature([AmenityEntity, RoomAmenityEntity]), HotelsModule],
  controllers: [AmenitiesController, HotelAmenitiesController],
  providers: [
    AmenitiesService,
    {
      provide: AMENITY_REPOSITORY,
      useClass: TypeOrmAmenityRepository,
    },
  ],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
