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
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../authorization/decorators/public.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import type { Response } from 'express';
import {
  ApiCreateOperation,
  ApiDeleteOperation,
  ApiDetailOperation,
  ApiListOperation,
  ApiUpdateOperation,
} from '../../../common/openapi/api-crud.decorator';
import { CreateHotelDocumentRequest } from '../dtos/requests/create-hotel-document.request';
import { CreateHotelRequest } from '../dtos/requests/create-hotel.request';
import { ListHotelsRequest } from '../dtos/requests/list-hotels.request';
import { UpdateHotelRequest } from '../dtos/requests/update-hotel.request';
import {
  HotelDocumentResponse,
  HotelListResponse,
  HotelResponse,
} from '../dtos/responses/hotel.response';
import { HotelMapper } from '../mappers/hotel.mapper';
import { HotelsService } from '../services/hotels.service';

@ApiTags('Hotels')
@Roles(UserRole.HOTEL_OWNER, UserRole.ADMIN)
@Controller({ path: 'hotels', version: '1' })
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Post()
  @Roles(UserRole.HOTEL_OWNER)
  @ApiCreateOperation('Create a draft hotel', HotelResponse)
  async create(
    @CurrentUser() user: UserEntity,
    @Body() input: CreateHotelRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<HotelResponse> {
    const hotel = await this.hotelsService.create(user.id, input);
    response.setHeader('Location', `/api/v1/hotels/${hotel.id}`);
    return HotelMapper.toResponse(hotel);
  }

  @Get()
  @Public()
  @ApiListOperation('List hotels', HotelListResponse)
  async findPage(
    @Query() query: ListHotelsRequest,
  ): Promise<HotelListResponse> {
    const page = await this.hotelsService.findPublicPage(query);
    return HotelMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get('mine')
  @Roles(UserRole.HOTEL_OWNER)
  @ApiListOperation('List the current owner hotels', HotelListResponse)
  async findMine(
    @CurrentUser() user: UserEntity,
    @Query() query: ListHotelsRequest,
  ): Promise<HotelListResponse> {
    const page = await this.hotelsService.findOwnedPage(query, user.id);
    return HotelMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get('mine/:hotelId')
  @Roles(UserRole.HOTEL_OWNER)
  @ApiDetailOperation('Get a current owner hotel', HotelResponse, 'hotelId')
  async findMineById(
    @CurrentUser() user: UserEntity,
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<HotelResponse> {
    return HotelMapper.toResponse(
      await this.hotelsService.assertManagedBy(id, user),
    );
  }

  @Get(':hotelId')
  @Public()
  @ApiDetailOperation('Get a hotel', HotelResponse, 'hotelId')
  async findById(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<HotelResponse> {
    return HotelMapper.toResponse(await this.hotelsService.findPublicById(id));
  }

  @Patch(':hotelId')
  @ApiUpdateOperation('Update a hotel', HotelResponse, 'hotelId')
  async update(
    @CurrentUser() user: UserEntity,
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateHotelRequest,
  ): Promise<HotelResponse> {
    return HotelMapper.toResponse(
      await this.hotelsService.update(id, input, user),
    );
  }

  @Post(':hotelId/documents')
  @ApiCreateOperation('Add a hotel document', HotelDocumentResponse)
  async addDocument(
    @CurrentUser() user: UserEntity,
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Body() input: CreateHotelDocumentRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<HotelDocumentResponse> {
    const document = await this.hotelsService.addDocument(hotelId, input, user);
    response.setHeader(
      'Location',
      `/api/v1/hotels/${hotelId}/documents/${document.id}`,
    );
    return HotelMapper.toDocumentResponse(document);
  }

  @Delete(':hotelId/documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteOperation('Delete a hotel document', 'documentId')
  async deleteDocument(
    @CurrentUser() user: UserEntity,
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
  ): Promise<void> {
    await this.hotelsService.deleteDocument(hotelId, documentId, user);
  }

  @Put(':hotelId/submit')
  @ApiUpdateOperation('Submit a hotel for approval', HotelResponse, 'hotelId')
  async submit(
    @CurrentUser() user: UserEntity,
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<HotelResponse> {
    return HotelMapper.toResponse(await this.hotelsService.submit(id, user));
  }

  @Put(':hotelId/deactivate')
  @ApiUpdateOperation('Deactivate a hotel', HotelResponse, 'hotelId')
  async deactivate(
    @CurrentUser() user: UserEntity,
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<HotelResponse> {
    return HotelMapper.toResponse(
      await this.hotelsService.deactivate(id, user),
    );
  }
}
