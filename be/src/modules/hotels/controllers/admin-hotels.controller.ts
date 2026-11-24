import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import {
  ApiDetailOperation,
  ApiListOperation,
  ApiUpdateOperation,
} from '../../../common/openapi/api-crud.decorator';
import { ListHotelsRequest } from '../dtos/requests/list-hotels.request';
import { ReviewHotelRequest } from '../dtos/requests/review-hotel.request';
import {
  HotelListResponse,
  HotelResponse,
  HotelReviewHistoryResponse,
} from '../dtos/responses/hotel.response';
import { HotelMapper } from '../mappers/hotel.mapper';
import { HotelsService } from '../services/hotels.service';

@ApiTags('Admin Hotels')
@Roles(UserRole.ADMIN)
@Controller({ path: 'admin/hotels', version: '1' })
export class AdminHotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get()
  @ApiListOperation('List hotels for review', HotelListResponse)
  async findPage(
    @Query() query: ListHotelsRequest,
  ): Promise<HotelListResponse> {
    const page = await this.hotelsService.findPage(query);
    return HotelMapper.toListResponse(
      page.items,
      query.page,
      query.limit,
      page.total,
    );
  }

  @Get(':hotelId/review-history')
  @ApiOperation({ summary: 'Get hotel review history' })
  @ApiOkResponse({ type: HotelReviewHistoryResponse, isArray: true })
  async findReviewHistory(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<HotelReviewHistoryResponse[]> {
    const history = await this.hotelsService.findReviewHistory(id);
    return history.map((item) => HotelMapper.toReviewHistoryResponse(item));
  }

  @Get(':hotelId')
  @ApiDetailOperation('Get a hotel for review', HotelResponse, 'hotelId')
  async findById(
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<HotelResponse> {
    return HotelMapper.toResponse(await this.hotelsService.findById(id));
  }

  @Patch(':hotelId/status')
  @ApiUpdateOperation('Review or change hotel status', HotelResponse, 'hotelId')
  async review(
    @CurrentUser() user: UserEntity,
    @Param('hotelId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ReviewHotelRequest,
  ): Promise<HotelResponse> {
    return HotelMapper.toResponse(
      await this.hotelsService.review(id, user.id, input),
    );
  }
}
