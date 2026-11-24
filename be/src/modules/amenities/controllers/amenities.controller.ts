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
import type { Response } from 'express';
import {
  ApiCreateOperation,
  ApiDeleteOperation,
  ApiDetailOperation,
  ApiListOperation,
  ApiUpdateOperation,
} from '../../../common/openapi/api-crud.decorator';
import { CreateAmenityRequest } from '../dtos/requests/create-amenity.request';
import { ListAmenitiesRequest } from '../dtos/requests/list-amenities.request';
import { UpdateAmenityRequest } from '../dtos/requests/update-amenity.request';
import {
  AmenityListResponse,
  AmenityResponse,
} from '../dtos/responses/amenity.response';
import { AmenityMapper } from '../mappers/amenity.mapper';
import { AmenitiesService } from '../services/amenities.service';

@ApiTags('Amenities')
@Controller({ path: 'amenities', version: '1' })
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Post()
  @ApiCreateOperation('Create an amenity', AmenityResponse)
  async create(
    @Body() input: CreateAmenityRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AmenityResponse> {
    const amenity = await this.amenitiesService.create(input);
    response.setHeader('Location', `/api/v1/amenities/${amenity.id}`);
    return AmenityMapper.toResponse(amenity);
  }

  @Get()
  @ApiListOperation('List amenities', AmenityListResponse)
  async findPage(
    @Query() query: ListAmenitiesRequest,
  ): Promise<AmenityListResponse> {
    const page = await this.amenitiesService.findPage(query);
    return AmenityMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get(':amenityId')
  @ApiDetailOperation('Get an amenity', AmenityResponse, 'amenityId')
  async findById(
    @Param('amenityId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AmenityResponse> {
    return AmenityMapper.toResponse(await this.amenitiesService.findById(id));
  }

  @Patch(':amenityId')
  @ApiUpdateOperation('Update an amenity', AmenityResponse, 'amenityId')
  async update(
    @Param('amenityId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateAmenityRequest,
  ): Promise<AmenityResponse> {
    return AmenityMapper.toResponse(
      await this.amenitiesService.update(id, input),
    );
  }

  @Delete(':amenityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteOperation('Delete an amenity', 'amenityId')
  async delete(
    @Param('amenityId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.amenitiesService.delete(id);
  }
}
