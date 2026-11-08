import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmenitiesModule } from '../amenities/amenities.module';
import { HotelsModule } from '../hotels/hotels.module';
import { RoomsController } from './controllers/rooms.controller';
import { RoomAmenityEntity } from './entities/room-amenity.entity';
import { RoomEntity } from './entities/room.entity';
import { ROOM_REPOSITORY } from './interfaces/room.repository.interface';
import { TypeOrmRoomRepository } from './repositories/typeorm-room.repository';
import { RoomsService } from './services/rooms.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoomEntity, RoomAmenityEntity]),
    AmenitiesModule,
    HotelsModule,
  ],
  controllers: [RoomsController],
  providers: [
    RoomsService,
    {
      provide: ROOM_REPOSITORY,
      useClass: TypeOrmRoomRepository,
    },
  ],
  exports: [RoomsService],
})
export class RoomsModule {}
