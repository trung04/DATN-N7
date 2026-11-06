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
import { CreatePlaceRequest } from '../dtos/requests/create-place.request';
import { ListPlacesRequest } from '../dtos/requests/list-places.request';
import { UpdatePlaceRequest } from '../dtos/requests/update-place.request';
import {
  PlaceListResponse,
  PlaceResponse,
} from '../dtos/responses/place.response';
import { PlaceMapper } from '../mappers/place.mapper';
import { PlacesService } from '../services/places.service';

@Controller({ path: 'places', version: '1' })
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Post()
  async create(
    @Body() input: CreatePlaceRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlaceResponse> {
    const place = await this.placesService.create(input);
    response.setHeader('Location', `/api/v1/places/${place.id}`);
    return PlaceMapper.toResponse(place);
  }

  @Get()
  async findPage(
    @Query() query: ListPlacesRequest,
  ): Promise<PlaceListResponse> {
    const page = await this.placesService.findPage(query);
    return PlaceMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get(':placeId')
  async findById(
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PlaceResponse> {
    return PlaceMapper.toResponse(await this.placesService.findById(id));
  }

  @Patch(':placeId')
  async update(
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdatePlaceRequest,
  ): Promise<PlaceResponse> {
    return PlaceMapper.toResponse(await this.placesService.update(id, input));
  }

  @Delete(':placeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.placesService.delete(id);
  }
}
