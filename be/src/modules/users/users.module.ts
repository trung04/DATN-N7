import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './controllers/users.controller';
import { TravelPreferencesController } from './controllers/travel-preferences.controller';
import { AdminEntity } from './entities/admin.entity';
import { HotelOwnerEntity } from './entities/hotel-owner.entity';
import { TopicEntity } from './entities/topic.entity';
import { TouristEntity } from './entities/tourist.entity';
import { TravelPreferenceTopicEntity } from './entities/travel-preference-topic.entity';
import { TravelPreferenceEntity } from './entities/travel-preference.entity';
import { UserEntity } from './entities/user.entity';
import { UserImageEntity } from './entities/user-image.entity';
import { UserFavoriteEntity } from './entities/user-favorite.entity';
import { FavoritesController } from './controllers/favorites.controller';
import { BcryptPasswordHasher } from './integrations/password/bcrypt-password-hasher';
import { PASSWORD_HASHER } from './interfaces/password-hasher.interface';
import { USER_REPOSITORY } from './interfaces/user.repository.interface';
import { TRAVEL_PREFERENCE_REPOSITORY } from './interfaces/travel-preference.repository.interface';
import { TypeOrmUserRepository } from './repositories/typeorm-user.repository';
import { TypeOrmTravelPreferenceRepository } from './repositories/typeorm-travel-preference.repository';
import { TypeOrmFavoriteRepository } from './repositories/typeorm-favorite.repository';
import { UsersService } from './services/users.service';
import { TravelPreferencesService } from './services/travel-preferences.service';
import { FavoritesService } from './services/favorites.service';
import { FAVORITE_REPOSITORY } from './interfaces/favorite.repository.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AdminEntity,
      TouristEntity,
      HotelOwnerEntity,
      TopicEntity,
      TravelPreferenceEntity,
      TravelPreferenceTopicEntity,
      UserImageEntity,
      UserFavoriteEntity,
    ]),
  ],
  controllers: [UsersController, TravelPreferencesController, FavoritesController],
  providers: [
    UsersService,
    TravelPreferencesService,
    FavoritesService,
    { provide: FAVORITE_REPOSITORY, useClass: TypeOrmFavoriteRepository },
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: TRAVEL_PREFERENCE_REPOSITORY,
      useClass: TypeOrmTravelPreferenceRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
