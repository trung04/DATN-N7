import { ReviewStatus } from '../../entities/review.entity';

export class ReviewResponse {
  id: string;
  bookingId: string;
  bookingCode: string;
  hotelId: string;
  hotelName: string;
  userId: string;
  reviewerName: string;
  reviewerEmail: string | null;
  stars: number;
  content: string;
  status: ReviewStatus;
  moderationReason: string | null;
  moderatedBy: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ReviewListResponse {
  data: ReviewResponse[];
  meta: { page: number; limit: number; total: number };
}

export class ReviewSummaryResponse {
  hotelId: string;
  averageRating: number;
  visibleCount: number;
  pendingCount?: number;
}

export class ReviewModerationHistoryResponse {
  id: string;
  reviewId: string;
  actorUserId: string;
  action: string;
  reason: string | null;
  createdAt: string;
}
