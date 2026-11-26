import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import {
  PlanTravelRequest,
  RecommendTravelRequest,
} from '../dtos/requests/travel-ai.request';
import { TravelAiService } from '../services/travel-ai.service';

@ApiTags('Travel AI')
@ApiCookieAuth()
@Roles(UserRole.TOURIST)
@Controller({ path: 'ai', version: '1' })
export class TravelAiController {
  constructor(private readonly travelAi: TravelAiService) {}

  @Post('recommendations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suggest places and hotels for the authenticated tourist',
  })
  recommend(
    @CurrentUser() user: UserEntity,
    @Body() input: RecommendTravelRequest,
  ) {
    return this.travelAi.recommend(user.id, input);
  }

  @Post('trip-planner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a trip preview without saving an itinerary',
  })
  plan(@CurrentUser() user: UserEntity, @Body() input: PlanTravelRequest) {
    return this.travelAi.plan(user.id, input);
  }
}
