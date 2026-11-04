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
import { CreateActivityRequest } from '../dtos/requests/create-activity.request';
import { ListActivitiesRequest } from '../dtos/requests/list-activities.request';
import { UpdateActivityRequest } from '../dtos/requests/update-activity.request';
import {
  ActivityListResponse,
  ActivityResponse,
} from '../dtos/responses/activity.response';
import { ActivityMapper } from '../mappers/activity.mapper';
import { ActivitiesService } from '../services/activities.service';

@Controller({ path: 'stopovers/:stopoverId/activities', version: '1' })
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  async create(
    @Param('stopoverId', new ParseUUIDPipe({ version: '4' }))
    stopoverId: string,
    @Body() input: CreateActivityRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ActivityResponse> {
    const activity = await this.activitiesService.create(stopoverId, input);
    response.setHeader(
      'Location',
      `/api/v1/stopovers/${stopoverId}/activities/${activity.id}`,
    );
    return ActivityMapper.toResponse(activity);
  }

  @Get()
  async findPage(
    @Param('stopoverId', new ParseUUIDPipe({ version: '4' }))
    stopoverId: string,
    @Query() query: ListActivitiesRequest,
  ): Promise<ActivityListResponse> {
    const page = await this.activitiesService.findPage(stopoverId, query);
    return ActivityMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get(':activityId')
  async findById(
    @Param('stopoverId', new ParseUUIDPipe({ version: '4' }))
    stopoverId: string,
    @Param('activityId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ActivityResponse> {
    return ActivityMapper.toResponse(
      await this.activitiesService.findById(stopoverId, id),
    );
  }

  @Patch(':activityId')
  async update(
    @Param('stopoverId', new ParseUUIDPipe({ version: '4' }))
    stopoverId: string,
    @Param('activityId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateActivityRequest,
  ): Promise<ActivityResponse> {
    return ActivityMapper.toResponse(
      await this.activitiesService.update(stopoverId, id, input),
    );
  }

  @Delete(':activityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('stopoverId', new ParseUUIDPipe({ version: '4' }))
    stopoverId: string,
    @Param('activityId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.activitiesService.delete(stopoverId, id);
  }
}
