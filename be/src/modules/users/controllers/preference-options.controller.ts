import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { PreferenceOptionsResponse } from '../dtos/responses/travel-preference.response';
import { TravelPreferencesService } from '../services/travel-preferences.service';

@ApiTags('Travel preferences')
@Roles(UserRole.TOURIST)
@Controller({ path: 'users/me/preference-options', version: '1' })
export class PreferenceOptionsController {
  constructor(private readonly service: TravelPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'List category and topic preferences backed by active places' })
  @ApiOkResponse({ type: PreferenceOptionsResponse })
  findOptions(): Promise<PreferenceOptionsResponse> {
    return this.service.findOptions();
  }
}
