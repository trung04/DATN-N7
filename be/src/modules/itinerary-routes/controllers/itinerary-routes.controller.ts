import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import { GenerateRouteRequest } from '../dtos/requests/generate-route.request';
import { RouteQueryRequest } from '../dtos/requests/route-query.request';
import { ItineraryRouteResponse } from '../dtos/responses/itinerary-route.response';
import { ItineraryRouteMapper } from '../mappers/itinerary-route.mapper';
import { ItineraryRoutesService } from '../services/itinerary-routes.service';

@Roles(UserRole.TOURIST)
@Controller({ path: 'itineraries/:itineraryId/routes', version: '1' })
export class ItineraryRoutesController {
  constructor(private readonly routesService: ItineraryRoutesService) {}

  @Get()
  async findCurrent(
    @Param('itineraryId', new ParseUUIDPipe({ version: '4' }))
    itineraryId: string,
    @Query() query: RouteQueryRequest,
    @CurrentUser() user: UserEntity,
  ): Promise<ItineraryRouteResponse> {
    return ItineraryRouteMapper.toResponse(
      await this.routesService.findCurrent(itineraryId, query, user.id),
    );
  }

  @Post()
  async generate(
    @Param('itineraryId', new ParseUUIDPipe({ version: '4' }))
    itineraryId: string,
    @Body() input: GenerateRouteRequest,
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ItineraryRouteResponse> {
    const route = await this.routesService.generate(
      itineraryId,
      input,
      user.id,
    );
    response.setHeader(
      'Location',
      `/api/v1/itineraries/${itineraryId}/routes?routeDate=${route.routeDate}&profile=${route.profile}`,
    );
    return ItineraryRouteMapper.toResponse(route);
  }
}
