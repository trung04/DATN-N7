import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmenitiesModule } from '../amenities/amenities.module';
import { HotelsModule } from '../hotels/hotels.module';
import { RoomsController } from './controllers/rooms.controller';
import { RoomGuestPolicyEntity } from './entities/room-guest-policy.entity';
import { RoomAmenityEntity } from './entities/room-amenity.entity';
import { RoomEntity } from './entities/room.entity';
import { ROOM_REPOSITORY } from './interfaces/room.repository.interface';
import { TypeOrmRoomRepository } from './repositories/typeorm-room.repository';
import { RoomsService } from './services/rooms.service';
import { RoomImagesController } from './controllers/room-images.controller';
import { RoomImagesService } from './services/room-images.service';
import { RoomImageEntity } from './entities/room-image.entity';
import { ROOM_IMAGE_REPOSITORY } from './interfaces/room-image.repository.interface';
import { TypeOrmRoomImageRepository } from './repositories/typeorm-room-image.repository';
import { RoomImageManagementGuard } from './guards/room-image-management.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoomEntity,
      RoomAmenityEntity,
      RoomGuestPolicyEntity,
      RoomImageEntity,
    ]),
    AmenitiesModule,
    HotelsModule,
  ],
  controllers: [RoomsController, RoomImagesController],
  providers: [
    RoomsService,
    RoomImagesService,
    RoomImageManagementGuard,
    { provide: ROOM_IMAGE_REPOSITORY, useClass: TypeOrmRoomImageRepository },
    {
      provide: ROOM_REPOSITORY,
      useClass: TypeOrmRoomRepository,
    },
  ],
  exports: [RoomsService],
})
export class RoomsModule {}
