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
import { CreateRoomRequest } from '../dtos/requests/create-room.request';
import { ListRoomsRequest } from '../dtos/requests/list-rooms.request';
import { UpdateRoomRequest } from '../dtos/requests/update-room.request';
import {
  RoomListResponse,
  RoomResponse,
} from '../dtos/responses/room.response';
import { RoomMapper } from '../mappers/room.mapper';
import { RoomsService } from '../services/rooms.service';

@Controller({ path: 'rooms', version: '1' })
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  async create(
    @Body() input: CreateRoomRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RoomResponse> {
    const room = await this.roomsService.create(input);
    response.setHeader('Location', `/api/v1/rooms/${room.room.id}`);
    return RoomMapper.toResponse(room);
  }

  @Get()
  async findPage(@Query() query: ListRoomsRequest): Promise<RoomListResponse> {
    const page = await this.roomsService.findPage(query);
    return RoomMapper.toListResponse(page, query.page, query.limit);
  }

  @Get(':roomId')
  async findById(
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<RoomResponse> {
    return RoomMapper.toResponse(await this.roomsService.findById(id));
  }

  @Patch(':roomId')
  async update(
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateRoomRequest,
  ): Promise<RoomResponse> {
    return RoomMapper.toResponse(await this.roomsService.update(id, input));
  }

  @Delete(':roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.roomsService.delete(id);
  }
}
