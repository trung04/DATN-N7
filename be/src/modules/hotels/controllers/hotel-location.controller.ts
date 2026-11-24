import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { SearchHotelLocationRequest } from '../dtos/requests/search-hotel-location.request';
import { HotelLocationService } from '../services/hotel-location.service';

@ApiTags('Hotels')
@Roles(UserRole.HOTEL_OWNER, UserRole.ADMIN)
@Controller({ path: 'hotels/location-search', version: '1' })
export class HotelLocationController {
  constructor(private readonly service: HotelLocationService) {}

  @Get()
  @ApiOperation({ summary: 'Find hotel address suggestions in Vietnam' })
  search(@Query() query: SearchHotelLocationRequest) {
    return this.service.search(query.q);
  }
}
