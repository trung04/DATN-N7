import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItinerariesModule } from '../itineraries/itineraries.module';
import { StopoversController } from './controllers/stopovers.controller';
import { StopoverEntity } from './entities/stopover.entity';
import { STOPOVER_REPOSITORY } from './interfaces/stopover.repository.interface';
import { TypeOrmStopoverRepository } from './repositories/typeorm-stopover.repository';
import { StopoversService } from './services/stopovers.service';

@Module({
  imports: [TypeOrmModule.forFeature([StopoverEntity]), ItinerariesModule],
  controllers: [StopoversController],
  providers: [
    StopoversService,
    {
      provide: STOPOVER_REPOSITORY,
      useClass: TypeOrmStopoverRepository,
    },
  ],
  exports: [StopoversService],
})
export class StopoversModule {}
