import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelsModule } from '../hotels/hotels.module';
import { BookingEntity } from '../bookings/entities/booking.entity';
import { ReportsController } from './controllers/reports.controller';
import { ReportsService } from './services/reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([BookingEntity]), HotelsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
