import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './controllers/users.controller';
import { AdminEntity } from './entities/admin.entity';
import { HotelOwnerEntity } from './entities/hotel-owner.entity';
import { TopicEntity } from './entities/topic.entity';
import { TouristEntity } from './entities/tourist.entity';
import { TravelPreferenceTopicEntity } from './entities/travel-preference-topic.entity';
import { TravelPreferenceEntity } from './entities/travel-preference.entity';
import { UserEntity } from './entities/user.entity';
import { UserImageEntity } from './entities/user-image.entity';
import { BcryptPasswordHasher } from './integrations/password/bcrypt-password-hasher';
import { PASSWORD_HASHER } from './interfaces/password-hasher.interface';
import { USER_REPOSITORY } from './interfaces/user.repository.interface';
import { TypeOrmUserRepository } from './repositories/typeorm-user.repository';
import { UsersService } from './services/users.service';

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
    ]),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
