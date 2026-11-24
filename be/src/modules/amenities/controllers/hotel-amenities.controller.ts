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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import {
  ApiCreateOperation,
  ApiDeleteOperation,
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

@ApiTags('Hotel Amenities')
@Roles(UserRole.HOTEL_OWNER)
@Controller({ path: 'hotels/:hotelId/amenities', version: '1' })
export class HotelAmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Post()
  @ApiCreateOperation('Create a hotel-specific amenity', AmenityResponse)
  async create(
    @CurrentUser() user: UserEntity,
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Body() input: CreateAmenityRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AmenityResponse> {
    const amenity = await this.amenitiesService.createForHotel(hotelId, input, user);
    response.setHeader('Location', `/api/v1/hotels/${hotelId}/amenities/${amenity.id}`);
    return AmenityMapper.toResponse(amenity);
  }

  @Get()
  @ApiListOperation('List amenities for a managed hotel', AmenityListResponse)
  async findPage(
    @CurrentUser() user: UserEntity,
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Query() query: ListAmenitiesRequest,
  ): Promise<AmenityListResponse> {
    const page = await this.amenitiesService.findHotelPage(hotelId, query, user);
    return AmenityMapper.toListResponse(page.items, query.page, query.limit, page.total);
  }

  @Patch(':amenityId')
  @ApiUpdateOperation('Update a hotel-specific amenity', AmenityResponse, 'amenityId')
  async update(
    @CurrentUser() user: UserEntity,
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Param('amenityId', new ParseUUIDPipe({ version: '4' })) amenityId: string,
    @Body() input: UpdateAmenityRequest,
  ): Promise<AmenityResponse> {
    return AmenityMapper.toResponse(
      await this.amenitiesService.updateForHotel(hotelId, amenityId, input, user),
    );
  }

  @Delete(':amenityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteOperation('Delete a hotel-specific amenity', 'amenityId')
  async delete(
    @CurrentUser() user: UserEntity,
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Param('amenityId', new ParseUUIDPipe({ version: '4' })) amenityId: string,
  ): Promise<void> {
    await this.amenitiesService.deleteForHotel(hotelId, amenityId, user);
  }
}
