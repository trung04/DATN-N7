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
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../authorization/decorators/public.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import type { Response } from 'express';
import {
  ApiCreateOperation,
  ApiDeleteOperation,
  ApiDetailOperation,
  ApiListOperation,
  ApiUpdateOperation,
} from '../../../common/openapi/api-crud.decorator';
import { CreatePlaceRequest } from '../dtos/requests/create-place.request';
import { ListPlacesRequest } from '../dtos/requests/list-places.request';
import { UpdatePlaceRequest } from '../dtos/requests/update-place.request';
import {
  PlaceListResponse,
  PlaceResponse,
} from '../dtos/responses/place.response';
import { PlaceMapper } from '../mappers/place.mapper';
import { PlacesService } from '../services/places.service';

@ApiTags('Places')
@Roles(UserRole.ADMIN)
@Controller({ path: 'places', version: '1' })
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Post()
  @ApiCreateOperation('Create a place', PlaceResponse)
  async create(
    @Body() input: CreatePlaceRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlaceResponse> {
    const place = await this.placesService.create(input);
    response.setHeader('Location', `/api/v1/places/${place.id}`);
    return PlaceMapper.toResponse(
      await this.placesService.findDetailsById(place.id),
    );
  }

  @Get()
  @Public()
  @ApiListOperation('List places', PlaceListResponse)
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

  @Get('options')
  async findCatalogOptions() {
    return this.placesService.findCatalogOptions();
  }

  @Get(':placeId')
  @Public()
  @ApiDetailOperation('Get a place', PlaceResponse, 'placeId')
  async findById(
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PlaceResponse> {
    return PlaceMapper.toResponse(await this.placesService.findDetailsById(id));
  }

  @Patch(':placeId')
  @ApiUpdateOperation('Update a place', PlaceResponse, 'placeId')
  async update(
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdatePlaceRequest,
  ): Promise<PlaceResponse> {
    const place = await this.placesService.update(id, input);
    return PlaceMapper.toResponse(
      await this.placesService.findDetailsById(place.id),
    );
  }

  @Delete(':placeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteOperation('Delete a place', 'placeId')
  async delete(
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.placesService.delete(id);
  }
}
