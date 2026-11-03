import 'reflect-metadata';
import { config as loadEnvironment } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/environment.validation';
import { AmenityEntity } from '../modules/amenities/entities/amenity.entity';
import { RoomAmenityEntity } from '../modules/rooms/entities/room-amenity.entity';
import { RoomEntity } from '../modules/rooms/entities/room.entity';
import { UserEntity } from '../modules/users/entities/user.entity';
import { HotelOwnerEntity } from '../modules/hotel-owners/entities/hotel-owner.entity';
import { CreateAmenities1793696400000 } from './migrations/1793696400000-CreateAmenities';
import { RemoveAmenityType1793696500000 } from './migrations/1793696500000-RemoveAmenityType';
import { CreateRooms1793696600000 } from './migrations/1793696600000-CreateRooms';
import { CreateUsers1793696700000 } from './migrations/1793696700000-CreateUsers';
import { CreateHotelOwners1793696800000 } from './migrations/1793696800000-CreateHotelOwners';

loadEnvironment();
const environment = validateEnvironment(process.env);

export default new DataSource({
  type: 'postgres',
  host: environment.DATABASE_HOST as string,
  port: environment.DATABASE_PORT as number,
  username: environment.DATABASE_USER as string,
  password: environment.DATABASE_PASSWORD as string,
  database: environment.DATABASE_NAME as string,
  ssl: environment.DATABASE_SSL ? { rejectUnauthorized: true } : false,
  entities: [
    AmenityEntity,
    RoomEntity,
    RoomAmenityEntity,
    UserEntity,
    HotelOwnerEntity,
  ],
  migrations: [
    CreateAmenities1793696400000,
    RemoveAmenityType1793696500000,
    CreateRooms1793696600000,
    CreateUsers1793696700000,
    CreateHotelOwners1793696800000,
  ],
  synchronize: false,
  logging: false,
});
