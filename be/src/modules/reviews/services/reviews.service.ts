import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AuthorizationDeniedException } from '../../authorization/exceptions/authorization.exceptions';
import type { AuthorizationActor } from '../../authorization/interfaces/authorization-actor.interface';
import { BookingEntity, BookingStatus } from '../../bookings/entities/booking.entity';
import { HotelsService } from '../../hotels/services/hotels.service';
import { UserRole } from '../../users/entities/user.entity';
import { CreateReviewRequest } from '../dtos/requests/create-review.request';
import { ListReviewsRequest, ReviewSortField } from '../dtos/requests/list-reviews.request';
import {
  ModerateReviewRequest,
  ReviewModerationAction,
} from '../dtos/requests/moderate-review.request';
import { ReviewModerationHistoryEntity } from '../entities/review-moderation-history.entity';
import { ReviewEntity, ReviewStatus } from '../entities/review.entity';
import {
  DuplicateBookingReviewException,
  InvalidReviewDateRangeException,
  InvalidReviewModerationException,
  ReviewBookingNotCompletedException,
  ReviewBookingNotFoundException,
  ReviewHotelFilterRequiredException,
  ReviewNotFoundException,
} from '../exceptions/review.exceptions';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly reviews: Repository<ReviewEntity>,
    @InjectRepository(ReviewModerationHistoryEntity)
    private readonly history: Repository<ReviewModerationHistoryEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookings: Repository<BookingEntity>,
    private readonly hotelsService: HotelsService,
  ) {}

  async createForBooking(
    bookingId: string,
    userId: string,
    input: CreateReviewRequest,
  ): Promise<ReviewEntity> {
    try {
      const created = await this.reviews.manager.transaction(async (manager) => {
        const booking = await manager
          .getRepository(BookingEntity)
          .createQueryBuilder('booking')
          .setLock('pessimistic_write')
          .where('booking.id = :bookingId', { bookingId })
          .getOne();
        if (!booking) throw new ReviewBookingNotFoundException();
        if (booking.touristId !== userId) throw new AuthorizationDeniedException();
        if (booking.bookingStatus !== BookingStatus.COMPLETED) {
          throw new ReviewBookingNotCompletedException();
        }
        const repository = manager.getRepository(ReviewEntity);
        const review = repository.create({
          bookingId,
          hotelId: booking.hotelId,
          userId,
          stars: input.stars,
          content: input.content.trim(),
          status: ReviewStatus.PENDING,
          moderationReason: null,
          moderatedBy: null,
          moderatedAt: null,
        });
        return repository.save(review);
      });
      return this.findById(created.id);
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async findMyBookingReview(
    bookingId: string,
    actor: AuthorizationActor,
  ): Promise<ReviewEntity | null> {
    const booking = await this.bookings.findOneBy({ id: bookingId });
    if (!booking) throw new ReviewBookingNotFoundException();
    if (booking.touristId !== actor.id || actor.role !== UserRole.TOURIST) {
      throw new AuthorizationDeniedException();
    }
    const review = await this.reviews.findOne({ where: { bookingId, userId: actor.id } });
    return review ? this.findById(review.id) : null;
  }

  async findPage(
    input: ListReviewsRequest,
    actor: AuthorizationActor,
  ): Promise<{ items: ReviewEntity[]; total: number }> {
    if (input.createdFrom && input.createdTo && input.createdFrom > input.createdTo) {
      throw new InvalidReviewDateRangeException();
    }
    let hotelId = input.hotelId;
    if (actor.role === UserRole.HOTEL_OWNER) {
      if (!hotelId) throw new ReviewHotelFilterRequiredException();
      await this.hotelsService.assertManagedBy(hotelId, actor);
    }

    const query = this.reviewQuery();
    if (hotelId) query.andWhere('review.hotelId = :hotelId', { hotelId });
    if (input.status) query.andWhere('review.status = :status', { status: input.status });
    if (input.stars) query.andWhere('review.stars = :stars', { stars: input.stars });
    if (input.search) {
      const escaped = input.search.replace(/[\\%_]/g, '\\$&');
      query.andWhere(`(
        review.content ILIKE :search ESCAPE '\\' OR
        reviewer.displayName ILIKE :search ESCAPE '\\' OR
        reviewer.username ILIKE :search ESCAPE '\\' OR
        reviewer.email ILIKE :search ESCAPE '\\' OR
        booking.bookingCode ILIKE :search ESCAPE '\\' OR
        hotel.name ILIKE :search ESCAPE '\\'
      )`, { search: `%${escaped}%` });
    }
    if (input.createdFrom) {
      query.andWhere('review.createdAt >= :createdFrom', {
        createdFrom: new Date(input.createdFrom),
      });
    }
    if (input.createdTo) {
      query.andWhere('review.createdAt <= :createdTo', {
        createdTo: this.endOfDate(input.createdTo),
      });
    }

    const sortColumn = input.sortBy === ReviewSortField.STARS
      ? 'review.stars'
      : 'review.createdAt';
    const [items, total] = await query
      .orderBy(sortColumn, input.sortOrder, 'NULLS LAST')
      .addOrderBy('review.id', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit)
      .getManyAndCount();
    return { items, total };
  }

  async findPublicPage(
    input: ListReviewsRequest,
  ): Promise<{ items: ReviewEntity[]; total: number }> {
    if (!input.hotelId) throw new ReviewHotelFilterRequiredException();
    if (input.createdFrom && input.createdTo && input.createdFrom > input.createdTo) {
      throw new InvalidReviewDateRangeException();
    }
    const query = this.reviewQuery()
      .andWhere('review.hotelId = :hotelId', { hotelId: input.hotelId })
      .andWhere('review.status = :status', { status: ReviewStatus.VISIBLE });
    if (input.stars) query.andWhere('review.stars = :stars', { stars: input.stars });
    if (input.search) {
      const escaped = input.search.replace(/[\\%_]/g, '\\$&');
      query.andWhere('review.content ILIKE :search ESCAPE \'\\\'', {
        search: `%${escaped}%`,
      });
    }
    if (input.createdFrom) query.andWhere('review.createdAt >= :createdFrom', { createdFrom: new Date(input.createdFrom) });
    if (input.createdTo) query.andWhere('review.createdAt <= :createdTo', { createdTo: this.endOfDate(input.createdTo) });
    const sortColumn = input.sortBy === ReviewSortField.STARS ? 'review.stars' : 'review.createdAt';
    const [items, total] = await query
      .orderBy(sortColumn, input.sortOrder, 'NULLS LAST')
      .addOrderBy('review.id', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit)
      .getManyAndCount();
    return { items, total };
  }

  async summary(
    hotelId: string,
    actor?: AuthorizationActor,
  ): Promise<{ hotelId: string; averageRating: number; visibleCount: number; pendingCount?: number }> {
    if (actor?.role === UserRole.HOTEL_OWNER) {
      await this.hotelsService.assertManagedBy(hotelId, actor);
    }
    const visible = await this.reviews
      .createQueryBuilder('review')
      .select('COALESCE(AVG(review.stars), 0)', 'averageRating')
      .addSelect('COUNT(review.id)', 'visibleCount')
      .where('review.hotelId = :hotelId', { hotelId })
      .andWhere('review.status = :status', { status: ReviewStatus.VISIBLE })
      .getRawOne<{ averageRating: string; visibleCount: string }>();
    const result = {
      hotelId,
      averageRating: Number(visible?.averageRating ?? 0),
      visibleCount: Number(visible?.visibleCount ?? 0),
    };
    if (actor?.role === UserRole.ADMIN || actor?.role === UserRole.HOTEL_OWNER) {
      const pendingCount = await this.reviews.count({
        where: { hotelId, status: ReviewStatus.PENDING },
      });
      return { ...result, pendingCount };
    }
    return result;
  }

  async moderate(
    id: string,
    actorUserId: string,
    input: ModerateReviewRequest,
  ): Promise<ReviewEntity> {
    const result = await this.reviews.manager.transaction(async (manager) => {
      const repository = manager.getRepository(ReviewEntity);
      const review = await repository
        .createQueryBuilder('review')
        .setLock('pessimistic_write')
        .where('review.id = :id', { id })
        .getOne();
      if (!review) throw new ReviewNotFoundException(id);
      this.assertModerationAllowed(input.action, review.status);
      if (input.action === ReviewModerationAction.APPROVE || input.action === ReviewModerationAction.RESTORE) {
        review.status = ReviewStatus.VISIBLE;
        review.moderationReason = null;
      } else {
        review.status = ReviewStatus.HIDDEN;
        review.moderationReason = input.reason!.trim();
      }
      review.moderatedBy = actorUserId;
      review.moderatedAt = new Date();
      await repository.save(review);
      await manager.getRepository(ReviewModerationHistoryEntity).save({
        reviewId: review.id,
        actorUserId,
        action: input.action,
        reason: input.action === ReviewModerationAction.HIDE
          ? input.reason!.trim()
          : input.note?.trim() || null,
      });
      return review;
    });
    return this.findById(result.id);
  }

  async findHistory(id: string): Promise<ReviewModerationHistoryEntity[]> {
    if (!(await this.reviews.existsBy({ id }))) throw new ReviewNotFoundException(id);
    return this.history.find({ where: { reviewId: id }, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<ReviewEntity> {
    const review = await this.reviewQuery()
      .andWhere('review.id = :id', { id })
      .getOne();
    if (!review) throw new ReviewNotFoundException(id);
    return review;
  }

  async findByIdForActor(
    id: string,
    actor: AuthorizationActor,
  ): Promise<ReviewEntity> {
    const review = await this.findById(id);
    if (actor.role === UserRole.HOTEL_OWNER) {
      await this.hotelsService.assertManagedBy(review.hotelId, actor);
    }
    return review;
  }

  private reviewQuery() {
    return this.reviews
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.booking', 'booking')
      .leftJoinAndSelect('review.hotel', 'hotel')
      .leftJoinAndSelect('review.user', 'user')
      .select([
        'review.id', 'review.bookingId', 'review.hotelId', 'review.userId',
        'review.stars', 'review.content', 'review.status',
        'review.moderationReason', 'review.moderatedBy', 'review.moderatedAt',
        'review.createdAt', 'review.updatedAt',
        'booking.id', 'booking.bookingCode',
        'hotel.id', 'hotel.name',
        'user.id', 'user.displayName', 'user.username', 'user.email',
      ]);
  }

  private assertModerationAllowed(action: ReviewModerationAction, status: ReviewStatus): void {
    const allowed =
      (status === ReviewStatus.PENDING && [ReviewModerationAction.APPROVE, ReviewModerationAction.HIDE].includes(action)) ||
      (status === ReviewStatus.VISIBLE && action === ReviewModerationAction.HIDE) ||
      (status === ReviewStatus.HIDDEN && action === ReviewModerationAction.RESTORE);
    if (!allowed) throw new InvalidReviewModerationException(action, status);
  }

  private endOfDate(value: string): Date {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T23:59:59.999Z`)
      : new Date(value);
  }

  private rethrowDuplicate(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      throw new DuplicateBookingReviewException();
    }
    throw error;
  }
}
