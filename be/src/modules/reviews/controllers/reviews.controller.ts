import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../authorization/decorators/public.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import { ApiDetailOperation, ApiListOperation, ApiUpdateOperation } from '../../../common/openapi/api-crud.decorator';
import { ListReviewsRequest } from '../dtos/requests/list-reviews.request';
import { ModerateReviewRequest } from '../dtos/requests/moderate-review.request';
import { ReviewListResponse, ReviewModerationHistoryResponse, ReviewResponse, ReviewSummaryResponse } from '../dtos/responses/review.response';
import { ReviewMapper } from '../mappers/review.mapper';
import { ReviewsService } from '../services/reviews.service';

@ApiTags('Reviews')
@Roles(UserRole.ADMIN, UserRole.HOTEL_OWNER)
@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('public')
  @Public()
  @ApiListOperation('List visible reviews for a hotel', ReviewListResponse)
  async findPublicPage(@Query() query: ListReviewsRequest): Promise<ReviewListResponse> {
    const page = await this.reviewsService.findPublicPage(query);
    return ReviewMapper.toListResponse(page.items, query.page, query.limit, page.total, true);
  }

  @Get('summary')
  @Public()
  async summary(
    @Query('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
  ): Promise<ReviewSummaryResponse> {
    return ReviewMapper.toSummaryResponse(await this.reviewsService.summary(hotelId));
  }

  @Get('summary/management')
  async managementSummary(
    @CurrentUser() user: UserEntity,
    @Query('hotelId', new ParseUUIDPipe({ version: '4' })) hotelId: string,
  ): Promise<ReviewSummaryResponse> {
    return ReviewMapper.toSummaryResponse(await this.reviewsService.summary(hotelId, user));
  }

  @Get()
  @ApiListOperation('List hotel reviews for management', ReviewListResponse)
  async findPage(
    @CurrentUser() user: UserEntity,
    @Query() query: ListReviewsRequest,
  ): Promise<ReviewListResponse> {
    const page = await this.reviewsService.findPage(query, user);
    return ReviewMapper.toListResponse(page.items, query.page, query.limit, page.total);
  }

  @Get(':reviewId/history')
  @Roles(UserRole.ADMIN)
  async history(
    @Param('reviewId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReviewModerationHistoryResponse[]> {
    return (await this.reviewsService.findHistory(id)).map(ReviewMapper.toHistoryResponse);
  }

  @Get(':reviewId')
  @ApiDetailOperation('Get a review', ReviewResponse, 'reviewId')
  async findById(
    @CurrentUser() user: UserEntity,
    @Param('reviewId', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReviewResponse> {
    return ReviewMapper.toResponse(await this.reviewsService.findByIdForActor(id, user));
  }

  @Patch(':reviewId/moderation')
  @Roles(UserRole.ADMIN)
  @ApiUpdateOperation('Moderate a review', ReviewResponse, 'reviewId')
  async moderate(
    @CurrentUser() user: UserEntity,
    @Param('reviewId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ModerateReviewRequest,
  ): Promise<ReviewResponse> {
    return ReviewMapper.toResponse(await this.reviewsService.moderate(id, user.id, input));
  }
}
