import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../entities/user.entity';
import { SaveTravelPreferenceRequest } from '../dtos/requests/save-travel-preference.request';
import { TravelPreferenceResponse } from '../dtos/responses/travel-preference.response';
import { TravelPreferencesService } from '../services/travel-preferences.service';

@ApiTags('Travel preferences')
@Roles(UserRole.TOURIST)
@Controller({ path: 'users/me/preferences', version: '1' })
export class TravelPreferencesController {
  constructor(private readonly service: TravelPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated tourist travel preferences' })
  @ApiOkResponse({ type: TravelPreferenceResponse, nullable: true })
  findMine(@CurrentUser() user: UserEntity): Promise<TravelPreferenceResponse | null> {
    return this.service.findForUser(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Save the authenticated tourist travel preferences' })
  @ApiOkResponse({ type: TravelPreferenceResponse })
  saveMine(
    @CurrentUser() user: UserEntity,
    @Body() input: SaveTravelPreferenceRequest,
  ): Promise<TravelPreferenceResponse> {
    return this.service.saveForUser(user.id, input);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete the authenticated tourist travel preferences' })
  @ApiNoContentResponse()
  deleteMine(@CurrentUser() user: UserEntity): Promise<void> {
    return this.service.deleteForUser(user.id);
  }
}
