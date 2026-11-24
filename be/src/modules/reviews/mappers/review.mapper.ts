import {
  ReviewListResponse,
  ReviewModerationHistoryResponse,
  ReviewResponse,
  ReviewSummaryResponse,
} from '../dtos/responses/review.response';
import { ReviewModerationHistoryEntity } from '../entities/review-moderation-history.entity';
import { ReviewEntity } from '../entities/review.entity';

export class ReviewMapper {
  static toResponse(review: ReviewEntity, publicView = false): ReviewResponse {
    return {
      id: review.id,
      bookingId: review.bookingId,
      bookingCode: review.booking?.bookingCode ?? '',
      hotelId: review.hotelId,
      hotelName: review.hotel?.name ?? '',
      userId: review.userId,
      reviewerName: review.user?.displayName || review.user?.username || 'Khách hàng',
      reviewerEmail: publicView ? null : review.user?.email ?? null,
      stars: review.stars,
      content: review.content,
      status: review.status,
      moderationReason: publicView ? null : review.moderationReason,
      moderatedBy: publicView ? null : review.moderatedBy,
      moderatedAt: publicView ? null : review.moderatedAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }

  static toListResponse(
    items: ReviewEntity[],
    page: number,
    limit: number,
    total: number,
    publicView = false,
  ): ReviewListResponse {
    return {
      data: items.map((item) => this.toResponse(item, publicView)),
      meta: { page, limit, total },
    };
  }

  static toSummaryResponse(summary: {
    hotelId: string;
    averageRating: number;
    visibleCount: number;
    pendingCount?: number;
  }): ReviewSummaryResponse {
    return summary;
  }

  static toHistoryResponse(
    item: ReviewModerationHistoryEntity,
  ): ReviewModerationHistoryResponse {
    return {
      id: item.id,
      reviewId: item.reviewId,
      actorUserId: item.actorUserId,
      action: item.action,
      reason: item.reason,
      createdAt: item.createdAt.toISOString(),
    };
  }
}
