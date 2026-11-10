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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import type { Response } from 'express';
import {
  ApiCreateOperation,
  ApiDeleteOperation,
  ApiDetailOperation,
  ApiListOperation,
  ApiUpdateOperation,
} from '../../../common/openapi/api-crud.decorator';
import { CreateHotelOwnerRequest } from '../dtos/requests/create-hotel-owner.request';
import { ListHotelOwnersRequest } from '../dtos/requests/list-hotel-owners.request';
import { UpdateHotelOwnerRequest } from '../dtos/requests/update-hotel-owner.request';
import {
  HotelOwnerListResponse,
  HotelOwnerResponse,
} from '../dtos/responses/hotel-owner.response';
import { HotelOwnerMapper } from '../mappers/hotel-owner.mapper';
import { HotelOwnersService } from '../services/hotel-owners.service';

@ApiTags('Hotel Owners')
@Roles(UserRole.HOTEL_OWNER, UserRole.ADMIN)
@Controller({ path: 'hotel-owners', version: '1' })
export class HotelOwnersController {
  constructor(private readonly hotelOwnersService: HotelOwnersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiCreateOperation('Create a hotel owner profile', HotelOwnerResponse)
  async create(
    @Body() input: CreateHotelOwnerRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<HotelOwnerResponse> {
    const hotelOwner = await this.hotelOwnersService.create(input);
    response.setHeader('Location', `/api/v1/hotel-owners/${hotelOwner.userId}`);
    return HotelOwnerMapper.toResponse(hotelOwner);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiListOperation('List hotel owner profiles', HotelOwnerListResponse)
  async findPage(
    @Query() query: ListHotelOwnersRequest,
  ): Promise<HotelOwnerListResponse> {
    const page = await this.hotelOwnersService.findPage(query);
    return HotelOwnerMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get(':userId')
  @ApiDetailOperation('Get a hotel owner profile', HotelOwnerResponse, 'userId')
  async findByUserId(
    @CurrentUser() user: UserEntity,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<HotelOwnerResponse> {
    return HotelOwnerMapper.toResponse(
      await this.hotelOwnersService.findByUserIdForActor(userId, user),
    );
  }

  @Patch(':userId')
  @ApiUpdateOperation(
    'Update a hotel owner profile',
    HotelOwnerResponse,
    'userId',
    { conflict: false },
  )
  async update(
    @CurrentUser() user: UserEntity,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() input: UpdateHotelOwnerRequest,
  ): Promise<HotelOwnerResponse> {
    return HotelOwnerMapper.toResponse(
      await this.hotelOwnersService.updateForActor(userId, input, user),
    );
  }

  @Delete(':userId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteOperation('Delete a hotel owner profile', 'userId')
  async delete(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<void> {
    await this.hotelOwnersService.delete(userId);
  }
}
