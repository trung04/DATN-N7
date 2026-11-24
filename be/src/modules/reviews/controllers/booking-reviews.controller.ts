import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../authorization/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import { ApiCreateOperation } from '../../../common/openapi/api-crud.decorator';
import { CreateReviewRequest } from '../dtos/requests/create-review.request';
import { ReviewResponse } from '../dtos/responses/review.response';
import { ReviewMapper } from '../mappers/review.mapper';
import { ReviewsService } from '../services/reviews.service';

@ApiTags('Reviews')
@Roles(UserRole.TOURIST)
@Controller({ path: 'bookings/:bookingId/reviews', version: '1' })
export class BookingReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiCreateOperation('Submit a review for a completed booking', ReviewResponse)
  async create(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @Body() input: CreateReviewRequest,
  ): Promise<ReviewResponse> {
    return ReviewMapper.toResponse(
      await this.reviewsService.createForBooking(bookingId, user.id, input),
    );
  }

  @Get('mine')
  async findMine(
    @CurrentUser() user: UserEntity,
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
  ): Promise<ReviewResponse | null> {
    const review = await this.reviewsService.findMyBookingReview(bookingId, user);
    return review ? ReviewMapper.toResponse(review) : null;
  }
}
