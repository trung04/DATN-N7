import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StopoversModule } from '../stopovers/stopovers.module';
import { ActivitiesController } from './controllers/activities.controller';
import { ActivityEntity } from './entities/activity.entity';
import { ACTIVITY_REPOSITORY } from './interfaces/activity.repository.interface';
import { TypeOrmActivityRepository } from './repositories/typeorm-activity.repository';
import { ActivitiesService } from './services/activities.service';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityEntity]), StopoversModule],
  controllers: [ActivitiesController],
  providers: [
    ActivitiesService,
    {
      provide: ACTIVITY_REPOSITORY,
      useClass: TypeOrmActivityRepository,
    },
  ],
})
export class ActivitiesModule {}
