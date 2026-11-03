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
import { CreateHotelOwnerRequest } from '../dtos/requests/create-hotel-owner.request';
import { ListHotelOwnersRequest } from '../dtos/requests/list-hotel-owners.request';
import { UpdateHotelOwnerRequest } from '../dtos/requests/update-hotel-owner.request';
import {
  HotelOwnerListResponse,
  HotelOwnerResponse,
} from '../dtos/responses/hotel-owner.response';
import { HotelOwnerMapper } from '../mappers/hotel-owner.mapper';
import { HotelOwnersService } from '../services/hotel-owners.service';

@Controller({ path: 'hotel-owners', version: '1' })
export class HotelOwnersController {
  constructor(private readonly hotelOwnersService: HotelOwnersService) {}

  @Post()
  async create(
    @Body() input: CreateHotelOwnerRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<HotelOwnerResponse> {
    const hotelOwner = await this.hotelOwnersService.create(input);
    response.setHeader('Location', `/api/v1/hotel-owners/${hotelOwner.userId}`);
    return HotelOwnerMapper.toResponse(hotelOwner);
  }

  @Get()
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
  async findByUserId(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<HotelOwnerResponse> {
    return HotelOwnerMapper.toResponse(
      await this.hotelOwnersService.findByUserId(userId),
    );
  }

  @Patch(':userId')
  async update(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() input: UpdateHotelOwnerRequest,
  ): Promise<HotelOwnerResponse> {
    return HotelOwnerMapper.toResponse(
      await this.hotelOwnersService.update(userId, input),
    );
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<void> {
    await this.hotelOwnersService.delete(userId);
  }
}
