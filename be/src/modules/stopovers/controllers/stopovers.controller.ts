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
import { Roles } from '../../authorization/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import { CreateStopoverRequest } from '../dtos/requests/create-stopover.request';
import { ListStopoversRequest } from '../dtos/requests/list-stopovers.request';
import { UpdateStopoverRequest } from '../dtos/requests/update-stopover.request';
import {
  StopoverListResponse,
  StopoverResponse,
} from '../dtos/responses/stopover.response';
import { StopoverMapper } from '../mappers/stopover.mapper';
import { StopoversService } from '../services/stopovers.service';

@Roles(UserRole.TOURIST)
@Controller({ path: 'itineraries/:itineraryId/stopovers', version: '1' })
export class StopoversController {
  constructor(private readonly stopoversService: StopoversService) {}

  @Post()
  async create(
    @Param('itineraryId', new ParseUUIDPipe({ version: '4' }))
    itineraryId: string,
    @Body() input: CreateStopoverRequest,
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StopoverResponse> {
    const stopover = await this.stopoversService.create(
      itineraryId,
      input,
      user.id,
    );
    response.setHeader(
      'Location',
      `/api/v1/itineraries/${itineraryId}/stopovers/${stopover.id}`,
    );
    return StopoverMapper.toResponse(stopover);
  }

  @Get()
  async findPage(
    @Param('itineraryId', new ParseUUIDPipe({ version: '4' }))
    itineraryId: string,
    @Query() query: ListStopoversRequest,
    @CurrentUser() user: UserEntity,
  ): Promise<StopoverListResponse> {
    const page = await this.stopoversService.findPage(
      itineraryId,
      query,
      user.id,
    );
    return StopoverMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get(':stopoverId')
  async findById(
    @Param('itineraryId', new ParseUUIDPipe({ version: '4' }))
    itineraryId: string,
    @Param('stopoverId', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<StopoverResponse> {
    return StopoverMapper.toResponse(
      await this.stopoversService.findByItineraryAndId(
        itineraryId,
        id,
        user.id,
      ),
    );
  }

  @Patch(':stopoverId')
  async update(
    @Param('itineraryId', new ParseUUIDPipe({ version: '4' }))
    itineraryId: string,
    @Param('stopoverId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateStopoverRequest,
    @CurrentUser() user: UserEntity,
  ): Promise<StopoverResponse> {
    return StopoverMapper.toResponse(
      await this.stopoversService.update(
        itineraryId,
        id,
        input,
        user.id,
      ),
    );
  }

  @Delete(':stopoverId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('itineraryId', new ParseUUIDPipe({ version: '4' }))
    itineraryId: string,
    @Param('stopoverId', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<void> {
    await this.stopoversService.delete(itineraryId, id, user.id);
  }
}
