import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import { UpdateBookingSettingsRequest } from '../dtos/requests/update-booking-settings.request';
import { BookingSettingsService } from '../services/booking-settings.service';

@ApiTags('Admin settings')
@Roles(UserRole.ADMIN)
@Controller({ path: 'admin/settings/bookings', version: '1' })
export class AdminBookingSettingsController {
  constructor(private readonly settings: BookingSettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Put()
  save(@Body() input: UpdateBookingSettingsRequest, @CurrentUser() user: UserEntity) {
    return this.settings.save(input.commissionRate, user);
  }
}
