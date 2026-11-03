import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { HotelOwnersController } from './controllers/hotel-owners.controller';
import { HotelOwnerEntity } from './entities/hotel-owner.entity';
import { HOTEL_OWNER_REPOSITORY } from './interfaces/hotel-owner.repository.interface';
import { TypeOrmHotelOwnerRepository } from './repositories/typeorm-hotel-owner.repository';
import { HotelOwnersService } from './services/hotel-owners.service';

@Module({
  imports: [TypeOrmModule.forFeature([HotelOwnerEntity]), UsersModule],
  controllers: [HotelOwnersController],
  providers: [
    HotelOwnersService,
    {
      provide: HOTEL_OWNER_REPOSITORY,
      useClass: TypeOrmHotelOwnerRepository,
    },
  ],
})
export class HotelOwnersModule {}
