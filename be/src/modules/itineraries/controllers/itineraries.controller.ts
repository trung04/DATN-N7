import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import { CreateItineraryRequest } from '../dtos/requests/create-itinerary.request';
import { ListItinerariesRequest } from '../dtos/requests/list-itineraries.request';
import { UpdateItineraryRequest } from '../dtos/requests/update-itinerary.request';
import {
  ItineraryListResponse,
  ItineraryResponse,
} from '../dtos/responses/itinerary.response';
import { ItineraryMapper } from '../mappers/itinerary.mapper';
import { ItinerariesService } from '../services/itineraries.service';

@Roles(UserRole.TOURIST)
@Controller({ path: 'itineraries', version: '1' })
export class ItinerariesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  @Post()
  async create(
    @Body() input: CreateItineraryRequest,
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ItineraryResponse> {
    const itinerary = await this.itinerariesService.create({
      ...input,
      touristUserId: user.id,
    });
    response.setHeader('Location', `/api/v1/itineraries/${itinerary.id}`);
    return ItineraryMapper.toResponse(itinerary);
  }

  @Get()
  async findPage(
    @Query() query: ListItinerariesRequest,
    @CurrentUser() user: UserEntity,
  ): Promise<ItineraryListResponse> {
    const page = await this.itinerariesService.findPage({
      ...query,
      touristUserId: user.id,
    });
    return ItineraryMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get(':itineraryId')
  async findById(
    @Param('itineraryId', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<ItineraryResponse> {
    return ItineraryMapper.toResponse(
      await this.itinerariesService.findByIdForTourist(id, user.id),
    );
  }

  @Patch(':itineraryId')
  async update(
    @Param('itineraryId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateItineraryRequest,
    @CurrentUser() user: UserEntity,
  ): Promise<ItineraryResponse> {
    return ItineraryMapper.toResponse(
      await this.itinerariesService.update(id, input, user.id),
    );
  }

  @Delete(':itineraryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('itineraryId', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<void> {
    await this.itinerariesService.delete(id, user.id);
  }
}
