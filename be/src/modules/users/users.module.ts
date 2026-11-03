import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './controllers/users.controller';
import { UserEntity } from './entities/user.entity';
import { BcryptPasswordHasher } from './integrations/password/bcrypt-password-hasher';
import { PASSWORD_HASHER } from './interfaces/password-hasher.interface';
import { USER_REPOSITORY } from './interfaces/user.repository.interface';
import { TypeOrmUserRepository } from './repositories/typeorm-user.repository';
import { UsersService } from './services/users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
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
})
export class UsersModule {}
