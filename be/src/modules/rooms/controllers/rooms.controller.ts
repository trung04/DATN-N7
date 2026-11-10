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
import { CreateRoomRequest } from '../dtos/requests/create-room.request';
import { ListRoomsRequest } from '../dtos/requests/list-rooms.request';
import { UpdateRoomRequest } from '../dtos/requests/update-room.request';
import {
  RoomListResponse,
  RoomResponse,
} from '../dtos/responses/room.response';
import { RoomMapper } from '../mappers/room.mapper';
import { RoomsService } from '../services/rooms.service';

@ApiTags('Rooms')
@Roles(UserRole.HOTEL_OWNER, UserRole.ADMIN)
@Controller({ path: 'rooms', version: '1' })
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiCreateOperation('Create a room', RoomResponse)
  async create(
    @CurrentUser() user: UserEntity,
    @Body() input: CreateRoomRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RoomResponse> {
    const room = await this.roomsService.create(input, user);
    response.setHeader('Location', `/api/v1/rooms/${room.room.id}`);
    return RoomMapper.toResponse(room);
  }

  @Get()
  @Public()
  @ApiListOperation('List rooms', RoomListResponse)
  async findPage(@Query() query: ListRoomsRequest): Promise<RoomListResponse> {
    const page = await this.roomsService.findPage(query);
    return RoomMapper.toListResponse(page, query.page, query.limit);
  }

  @Get(':roomId')
  @Public()
  @ApiDetailOperation('Get a room', RoomResponse, 'roomId')
  async findById(
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<RoomResponse> {
    return RoomMapper.toResponse(await this.roomsService.findById(id));
  }

  @Patch(':roomId')
  @ApiUpdateOperation('Update a room', RoomResponse, 'roomId')
  async update(
    @CurrentUser() user: UserEntity,
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateRoomRequest,
  ): Promise<RoomResponse> {
    return RoomMapper.toResponse(
      await this.roomsService.update(id, input, user),
    );
  }

  @Delete(':roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteOperation('Delete a room', 'roomId')
  async delete(
    @CurrentUser() user: UserEntity,
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.roomsService.delete(id, user);
  }
}
