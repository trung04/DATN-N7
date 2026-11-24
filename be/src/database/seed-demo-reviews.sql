-- Synthetic visible reviews for completed demo bookings.
-- This file is additive and safe to run repeatedly.

BEGIN;

WITH review_seed(id, booking_code, stars, content, created_at) AS (
  VALUES
    ('80000000-0000-4000-8000-000000000001'::uuid, 'DEMO-SETTLE-PAID_MAY_A-01', 5, 'Phòng sạch, nhân viên thân thiện và chỉ vài phút đi bộ ra biển. Bữa sáng có nhiều món địa phương.', now() - interval '32 days'),
    ('80000000-0000-4000-8000-000000000002'::uuid, 'DEMO-SETTLE-PAID_MAY_A-02', 4, 'Vị trí thuận tiện, hồ bơi đẹp. Phòng hơi nhỏ nhưng được dọn dẹp rất kỹ.', now() - interval '28 days'),
    ('80000000-0000-4000-8000-000000000003'::uuid, 'DEMO-SETTLE-PAID_MAY_A-03', 5, 'Một kỳ nghỉ dễ chịu, đội ngũ lễ tân hỗ trợ nhanh và gợi ý nhiều quán ăn hay.', now() - interval '24 days'),
    ('80000000-0000-4000-8000-000000000004'::uuid, 'DEMO-SETTLE-PAID_JUNE_B-01', 5, 'Không gian phố cổ rất đẹp vào buổi tối. Phòng yên tĩnh, giường thoải mái và có xe đạp miễn phí.', now() - interval '20 days'),
    ('80000000-0000-4000-8000-000000000005'::uuid, 'DEMO-SETTLE-PAID_JUNE_B-02', 4, 'Nhân viên nhiệt tình, vị trí sát sông. Bữa sáng ngon và phục vụ khá nhanh.', now() - interval '16 days'),
    ('80000000-0000-4000-8000-000000000006'::uuid, 'DEMO-SETTLE-PAID_MAY_A-04', 5, 'Phòng gia đình rộng, có ban công và tầm nhìn đẹp. Phù hợp cho chuyến đi cùng trẻ nhỏ.', now() - interval '12 days')
)
INSERT INTO reviews (
  id, booking_id, hotel_id, user_id, stars, content, status,
  moderated_by, moderated_at, created_at, updated_at
)
SELECT
  seed.id, booking.id, booking.hotel_id, booking.tourist_id, seed.stars,
  seed.content, 'VISIBLE', '70000000-0000-4000-8000-000000000001',
  now() - interval '1 day', seed.created_at, now()
FROM review_seed seed
JOIN bookings booking ON booking.booking_code = seed.booking_code
ON CONFLICT (booking_id) DO NOTHING;

INSERT INTO review_moderation_histories (id, review_id, actor_user_id, action, reason, created_at)
SELECT
  ('81000000-0000-4000-8000-' || lpad((row_number() OVER (ORDER BY review.id) + 100)::text, 12, '0'))::uuid,
  review.id,
  '70000000-0000-4000-8000-000000000001',
  'APPROVE',
  'Approved synthetic demo review.',
  review.moderated_at
FROM reviews review
WHERE review.id BETWEEN '80000000-0000-4000-8000-000000000001'::uuid
                    AND '80000000-0000-4000-8000-000000000006'::uuid
ON CONFLICT (id) DO NOTHING;

COMMIT;
