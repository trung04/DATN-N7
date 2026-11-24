import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Repository } from 'typeorm';
import type { BookingEntity } from '../../bookings/entities/booking.entity';
import type { HotelsService } from '../../hotels/services/hotels.service';
import type { ReviewModerationHistoryEntity } from '../entities/review-moderation-history.entity';
import { ReviewEntity, ReviewStatus } from '../entities/review.entity';
import { ReviewSummariesRequest } from '../dtos/requests/review-summaries.request';
import { ReviewsService } from './reviews.service';

const first = '71000000-0000-4000-8000-000000000001';
const second = '71000000-0000-4000-8000-000000000002';

describe('Public hotel review ratings', () => {
  const query = {
    select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(), getRawMany: jest.fn(),
  };
  const service = new ReviewsService(
    { createQueryBuilder: () => query } as unknown as Repository<ReviewEntity>,
    {} as Repository<ReviewModerationHistoryEntity>,
    {} as Repository<BookingEntity>, {} as HotelsService,
  );

  it('uses only published reviews and returns numeric ratings with zero for unrated hotels', async () => {
    query.getRawMany.mockResolvedValue([{ hotelId: first, averageRating: '4.75', visibleCount: '4' }]);
    await expect(service.publicSummaries([second, first])).resolves.toEqual([
      { hotelId: second, averageRating: 0, visibleCount: 0 },
      { hotelId: first, averageRating: 4.75, visibleCount: 4 },
    ]);
    expect(query.where).toHaveBeenCalledWith('review.hotelId IN (:...hotelIds)', { hotelIds: [second, first] });
    expect(query.andWhere).toHaveBeenCalledWith('review.status = :status', { status: ReviewStatus.VISIBLE });
  });

  it('does not substitute fake zero ratings when the database fails', async () => {
    query.getRawMany.mockRejectedValue(new Error('Unavailable'));
    await expect(service.publicSummaries([first])).rejects.toThrow('Unavailable');
    await expect(service.publicSummaries([])).resolves.toEqual([]);
  });

  it('accepts a bounded list of hotel UUIDs and rejects missing, duplicate or invalid IDs', async () => {
    const valid = plainToInstance(ReviewSummariesRequest, { hotelIds: `${first}, ${second}` });
    expect(valid.hotelIds).toEqual([first, second]);
    expect(await validate(valid)).toHaveLength(0);
    for (const hotelIds of [undefined, '', 'invalid', `${first},${first}`, Array(101).fill(first)]) {
      expect((await validate(plainToInstance(ReviewSummariesRequest, { hotelIds }))).length).toBeGreaterThan(0);
    }
  });
});
