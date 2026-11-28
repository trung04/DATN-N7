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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../authorization/decorators/public.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import type { UploadedLodgingImage } from '../../media/normalize-lodging-image';
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
import { PlaceFormDataInterceptor, PlaceImageUploadInterceptor } from '../interceptors/place-form-data.interceptor';
import { PlacesService } from '../services/places.service';

@ApiTags('Places')
@Roles(UserRole.ADMIN)
@Controller({ path: 'places', version: '1' })
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Post()
  @UseInterceptors(PlaceImageUploadInterceptor, PlaceFormDataInterceptor)
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiCreateOperation('Create a place', PlaceResponse)
  @ApiOperation({ description: 'To upload a cover photo, submit multipart fields data (the same JSON object as a string) and file (JPEG, PNG or WebP, max 5 MiB).' })
  async create(
    @Body() input: CreatePlaceRequest,
    @Res({ passthrough: true }) response: Response,
    @UploadedFile() file?: UploadedLodgingImage,
  ): Promise<PlaceResponse> {
    const place = await this.placesService.create(input, file);
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
  @UseInterceptors(PlaceImageUploadInterceptor, PlaceFormDataInterceptor)
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiUpdateOperation('Update a place', PlaceResponse, 'placeId')
  @ApiOperation({ description: 'To replace the cover photo, submit multipart fields data (the same JSON object as a string) and file (JPEG, PNG or WebP, max 5 MiB).' })
  async update(
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdatePlaceRequest,
    @UploadedFile() file?: UploadedLodgingImage,
  ): Promise<PlaceResponse> {
    const place = await this.placesService.update(id, input, file);
    return PlaceMapper.toResponse(
      await this.placesService.findDetailsById(place.id),
    );
  }

  @Get(':placeId/images/:imageId/file')
  @Public()
  @ApiOperation({ summary: 'Read an uploaded place photo' })
  async readImage(
    @Param('placeId', new ParseUUIDPipe({ version: '4' })) placeId: string,
    @Param('imageId', new ParseUUIDPipe({ version: '4' })) imageId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const data = await this.placesService.readImage(placeId, imageId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-cache');
    return new StreamableFile(data, { type: 'image/webp', length: data.length });
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
