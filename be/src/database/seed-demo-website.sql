-- Additive demo content for the public booking site and account dashboards.
-- All people, properties, bookings, and payment references are synthetic.
-- No provider API or email service is called by this script.
-- Demo accounts use the shared password: DemoOnly!2026

BEGIN;

INSERT INTO users (
  id, username, email, password_hash, first_name, last_name, display_name,
  phone_number, date_of_birth, gender, role, status, is_email_verified,
  created_at, updated_at
) VALUES
  ('70000000-0000-4000-8000-000000000001', 'demo.admin', 'admin@demo.example.test', '$2b$10$sCBpt3nQYPFF7cz2oK48aOpA2JDApBeO/vkCc2SC9LIxG5YZFjQua', 'Minh Anh', 'Nguyen', 'Minh Anh Nguyen', '+84911110001', '1988-04-12', 'FEMALE', 'ADMIN', 'ACTIVE', true, now() - interval '120 days', now()),
  ('70000000-0000-4000-8000-000000000002', 'demo.owner.danang', 'owner.danang@demo.example.test', '$2b$10$sCBpt3nQYPFF7cz2oK48aOpA2JDApBeO/vkCc2SC9LIxG5YZFjQua', 'Thanh', 'Tran', 'Thanh Tran', '+84911110002', '1984-08-22', 'MALE', 'HOTEL_OWNER', 'ACTIVE', true, now() - interval '100 days', now()),
  ('70000000-0000-4000-8000-000000000003', 'demo.owner.hoian', 'owner.hoian@demo.example.test', '$2b$10$sCBpt3nQYPFF7cz2oK48aOpA2JDApBeO/vkCc2SC9LIxG5YZFjQua', 'Linh', 'Pham', 'Linh Pham', '+84911110003', '1987-03-18', 'FEMALE', 'HOTEL_OWNER', 'ACTIVE', true, now() - interval '95 days', now()),
  ('70000000-0000-4000-8000-000000000004', 'demo.guest.minh', 'minh@demo.example.test', '$2b$10$sCBpt3nQYPFF7cz2oK48aOpA2JDApBeO/vkCc2SC9LIxG5YZFjQua', 'Minh', 'Le', 'Minh Le', '+84911110004', '1995-06-09', 'MALE', 'TOURIST', 'ACTIVE', true, now() - interval '80 days', now()),
  ('70000000-0000-4000-8000-000000000005', 'demo.guest.lan', 'lan@demo.example.test', '$2b$10$sCBpt3nQYPFF7cz2oK48aOpA2JDApBeO/vkCc2SC9LIxG5YZFjQua', 'Lan', 'Vo', 'Lan Vo', '+84911110005', '1992-11-02', 'FEMALE', 'TOURIST', 'ACTIVE', true, now() - interval '75 days', now()),
  ('70000000-0000-4000-8000-000000000006', 'demo.guest.an', 'an@demo.example.test', '$2b$10$sCBpt3nQYPFF7cz2oK48aOpA2JDApBeO/vkCc2SC9LIxG5YZFjQua', 'An', 'Nguyen', 'An Nguyen', '+84911110006', '1998-02-14', 'OTHER', 'TOURIST', 'ACTIVE', true, now() - interval '70 days', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO hotel_owners (user_id, bank_name, bank_account_number, bank_account_holder)
VALUES
  ('70000000-0000-4000-8000-000000000002', NULL, NULL, NULL),
  ('70000000-0000-4000-8000-000000000003', NULL, NULL, NULL)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO amenities (id, code, name, created_at, updated_at) VALUES
  ('75000000-0000-4000-8000-000000000001', 'WIFI', 'Wi-Fi miễn phí', now(), now()),
  ('75000000-0000-4000-8000-000000000002', 'BREAKFAST', 'Bữa sáng', now(), now()),
  ('75000000-0000-4000-8000-000000000003', 'POOL', 'Hồ bơi', now(), now()),
  ('75000000-0000-4000-8000-000000000004', 'AIR_CONDITIONING', 'Điều hòa', now(), now()),
  ('75000000-0000-4000-8000-000000000005', 'PARKING', 'Bãi đỗ xe', now(), now()),
  ('75000000-0000-4000-8000-000000000006', 'RESTAURANT', 'Nhà hàng', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO hotels (
  id, owner_user_id, place_id, name, legal_name, tax_code, description,
  address, phone_number, email, star_rating, check_in_time, check_out_time,
  status, submitted_at, reviewed_at, reviewed_by, created_at, updated_at
) VALUES
  ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'Son Tra Coastline Hotel', 'Son Tra Coastline Hotel', 'DEMO-HOTEL-0001', 'Khách sạn ven biển gần bãi Mỹ Khê, có hồ bơi tầng thượng, nhà hàng phục vụ bữa sáng và phòng nghỉ tiện nghi cho kỳ nghỉ thư giãn tại Đà Nẵng.', '36 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng', '+842363900001', 'hello@sontra.demo.example.test', 4, '14:00', '12:00', 'ACTIVE', now() - interval '90 days', now() - interval '89 days', '70000000-0000-4000-8000-000000000001', now() - interval '90 days', now()),
  ('71000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000005', 'Lantern House Hoi An', 'Lantern House Hoi An', 'DEMO-HOTEL-0002', 'Khách sạn phong cách boutique giữa phố cổ Hội An, có sân trong yên tĩnh, xe đạp miễn phí và lối đi bộ thuận tiện tới sông Hoài.', '14 Nguyễn Phúc Chu, Minh An, Hội An', '+842353900002', 'stay@lantern.demo.example.test', 4, '14:00', '11:00', 'ACTIVE', now() - interval '85 days', now() - interval '84 days', '70000000-0000-4000-8000-000000000001', now() - interval '85 days', now()),
  ('71000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000007', 'Perfume River Heritage Hotel', 'Perfume River Heritage Hotel', 'DEMO-HOTEL-0003', 'Không gian nghỉ dưỡng thanh lịch bên sông Hương, thuận tiện tham quan Đại Nội và các lăng tẩm. Khách sạn có nhà hàng phục vụ món địa phương và phòng nghỉ thoải mái.', '8 Lê Lợi, Vĩnh Ninh, Huế', '+842343900003', 'welcome@perfumeriver.demo.example.test', 5, '14:00', '12:00', 'ACTIVE', now() - interval '78 days', now() - interval '77 days', '70000000-0000-4000-8000-000000000001', now() - interval '78 days', now()),
  ('71000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000010', 'Pine Hill Retreat Da Lat', 'Pine Hill Retreat Da Lat', 'DEMO-HOTEL-0004', 'Khách sạn giữa đồi thông Đà Lạt, có ban công nhìn ra thung lũng, cà phê rang tại chỗ và không gian ấm cúng để thư giãn buổi tối.', '22 Trần Hưng Đạo, Đà Lạt, Lâm Đồng', '+842633900004', 'hello@pinehill.demo.example.test', 4, '15:00', '11:00', 'ACTIVE', now() - interval '72 days', now() - interval '71 days', '70000000-0000-4000-8000-000000000001', now() - interval '72 days', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO hotel_review_histories (id, hotel_id, actor_user_id, action, reason, created_at) VALUES
  ('81000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'APPROVED', 'Hồ sơ khách sạn đã được xét duyệt.', now() - interval '89 days'),
  ('81000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', 'APPROVED', 'Hồ sơ khách sạn đã được xét duyệt.', now() - interval '84 days'),
  ('81000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000001', 'APPROVED', 'Hồ sơ khách sạn đã được xét duyệt.', now() - interval '77 days'),
  ('81000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000001', 'APPROVED', 'Hồ sơ khách sạn đã được xét duyệt.', now() - interval '71 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (
  id, hotel_id, room_number, max_occupancy, price_per_night, currency,
  description, operational_status, room_type, created_at, updated_at
) VALUES
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '501', 2, 1850000, 'VND', 'Phòng giường king hướng thành phố, có ban công và bàn làm việc.', 'AVAILABLE', 'DELUXE KING', now(), now()),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', '702', 4, 2850000, 'VND', 'Phòng gia đình rộng rãi nhìn biển, phù hợp hai người lớn và trẻ em.', 'AVAILABLE', 'FAMILY SEA VIEW', now(), now()),
  ('72000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000002', '201', 2, 1650000, 'VND', 'Phòng boutique với nội thất gỗ, cửa sổ nhìn sân trong.', 'AVAILABLE', 'HERITAGE DOUBLE', now(), now()),
  ('72000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000002', '305', 3, 2350000, 'VND', 'Phòng suite có ban công, khu vực tiếp khách và bồn tắm.', 'AVAILABLE', 'RIVER SUITE', now(), now()),
  ('72000000-0000-4000-8000-000000000005', '71000000-0000-4000-8000-000000000003', '401', 2, 2100000, 'VND', 'Phòng nhìn sông với giường king và phòng tắm đá tự nhiên.', 'AVAILABLE', 'RIVER DELUXE', now(), now()),
  ('72000000-0000-4000-8000-000000000006', '71000000-0000-4000-8000-000000000003', '602', 4, 3200000, 'VND', 'Suite gia đình có phòng khách riêng và tầm nhìn ra sông Hương.', 'AVAILABLE', 'FAMILY SUITE', now(), now()),
  ('72000000-0000-4000-8000-000000000007', '71000000-0000-4000-8000-000000000004', '103', 2, 1450000, 'VND', 'Phòng đôi ấm cúng với cửa sổ nhìn rừng thông.', 'AVAILABLE', 'PINE DOUBLE', now(), now()),
  ('72000000-0000-4000-8000-000000000008', '71000000-0000-4000-8000-000000000004', '205', 4, 2450000, 'VND', 'Cabin gia đình có lò sưởi và ban công riêng nhìn thung lũng.', 'AVAILABLE', 'VALLEY FAMILY CABIN', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO room_amenities (room_id, amenity_id) VALUES
  ('72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000004'),
  ('72000000-0000-4000-8000-000000000002', '75000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000002', '75000000-0000-4000-8000-000000000002'),
  ('72000000-0000-4000-8000-000000000003', '75000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000003', '75000000-0000-4000-8000-000000000006'),
  ('72000000-0000-4000-8000-000000000004', '75000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000004', '75000000-0000-4000-8000-000000000003'),
  ('72000000-0000-4000-8000-000000000005', '75000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000005', '75000000-0000-4000-8000-000000000002'),
  ('72000000-0000-4000-8000-000000000006', '75000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000006', '75000000-0000-4000-8000-000000000006'),
  ('72000000-0000-4000-8000-000000000007', '75000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000007', '75000000-0000-4000-8000-000000000004'),
  ('72000000-0000-4000-8000-000000000008', '75000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000008', '75000000-0000-4000-8000-000000000005')
ON CONFLICT DO NOTHING;

INSERT INTO room_guest_policies (
  hotel_id, room_type, max_adults, max_children, adult_age_from,
  free_child_max_age, child_surcharge_per_night
) VALUES
  ('71000000-0000-4000-8000-000000000001', 'DELUXE KING', 2, 1, 12, 5, 250000),
  ('71000000-0000-4000-8000-000000000001', 'FAMILY SEA VIEW', 2, 2, 12, 6, 200000),
  ('71000000-0000-4000-8000-000000000002', 'HERITAGE DOUBLE', 2, 1, 12, 5, 200000),
  ('71000000-0000-4000-8000-000000000002', 'RIVER SUITE', 2, 1, 12, 5, 200000),
  ('71000000-0000-4000-8000-000000000003', 'RIVER DELUXE', 2, 1, 12, 5, 250000),
  ('71000000-0000-4000-8000-000000000003', 'FAMILY SUITE', 2, 2, 12, 6, 200000),
  ('71000000-0000-4000-8000-000000000004', 'PINE DOUBLE', 2, 1, 12, 5, 150000),
  ('71000000-0000-4000-8000-000000000004', 'VALLEY FAMILY CABIN', 2, 2, 12, 6, 150000)
ON CONFLICT DO NOTHING;

INSERT INTO cancellation_policies (
  id, hotel_id, name, cancel_hours, penalty_percent, cancellation_allowed,
  description, is_active, created_at, updated_at
) VALUES
  ('76000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'Flexible 24 hours', 24, 50, true, 'Hủy miễn phí trong 24 giờ sau khi đặt; sau đó áp dụng phí 50%.', true, now(), now()),
  ('76000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'Hoi An standard', 48, 30, true, 'Hủy miễn phí trước ngày nhận phòng ít nhất 48 giờ.', true, now(), now()),
  ('76000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000003', 'Heritage flexible', 24, 40, true, 'Hủy miễn phí trong 24 giờ sau khi đặt; phí 40% áp dụng sau thời hạn.', true, now(), now()),
  ('76000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000004', 'Retreat standard', 72, 25, true, 'Hủy miễn phí trước ngày nhận phòng ít nhất 72 giờ.', true, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO hotel_images (id, hotel_id, image_id, image_order) VALUES
  ('73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1),
  ('73000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', 2),
  ('73000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 1),
  ('73000000-0000-4000-8000-000000000005', '71000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 1),
  ('73000000-0000-4000-8000-000000000007', '71000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 1)
ON CONFLICT (id) DO NOTHING;

UPDATE hotel_images
SET deleted_at = now(), updated_at = now()
WHERE id IN (
  '73000000-0000-4000-8000-000000000004',
  '73000000-0000-4000-8000-000000000006',
  '73000000-0000-4000-8000-000000000008'
);

INSERT INTO room_images (id, room_id, image_id, image_order) VALUES
  ('74000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1),
  ('74000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005', 1),
  ('74000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 1),
  ('74000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 1),
  ('74000000-0000-4000-8000-000000000005', '72000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', 1),
  ('74000000-0000-4000-8000-000000000006', '72000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', 1),
  ('74000000-0000-4000-8000-000000000007', '72000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000004', 1),
  ('74000000-0000-4000-8000-000000000008', '72000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000004', 1)
ON CONFLICT (id) DO UPDATE SET
  image_id = EXCLUDED.image_id,
  image_order = EXCLUDED.image_order,
  deleted_at = NULL,
  updated_at = now();

INSERT INTO user_images (id, user_id, image_id, image_type) VALUES
  ('78100000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000006', 'AVATAR'),
  ('78100000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005', 'AVATAR'),
  ('78100000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'AVATAR'),
  ('78100000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'AVATAR'),
  ('78100000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', 'AVATAR'),
  ('78100000-0000-4000-8000-000000000006', '70000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000004', 'AVATAR')
ON CONFLICT (id) DO NOTHING;

INSERT INTO travel_preferences (
  user_id, min_budget, max_budget, currency, preferred_duration_days,
  travel_style, preferred_transport, preferred_destinations
) VALUES
  ('70000000-0000-4000-8000-000000000004', 2500000, 7000000, 'VND', 4, 'CULTURE_AND_FOOD', 'WALKING', ARRAY['Đà Nẵng', 'Hội An']),
  ('70000000-0000-4000-8000-000000000005', 3000000, 9000000, 'VND', 5, 'RELAXED', 'CAR', ARRAY['Huế', 'Đà Lạt']),
  ('70000000-0000-4000-8000-000000000006', 2000000, 6000000, 'VND', 3, 'ADVENTURE', 'MOTORBIKE', ARRAY['Đà Nẵng', 'Huế'])
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO travel_preference_topics (travel_preference_user_id, topic_id)
SELECT pref.user_id, topic.id
FROM (VALUES
  ('70000000-0000-4000-8000-000000000004'::uuid, 'FOOD'::text),
  ('70000000-0000-4000-8000-000000000004'::uuid, 'CULTURE'::text),
  ('70000000-0000-4000-8000-000000000005'::uuid, 'RELAXATION'::text),
  ('70000000-0000-4000-8000-000000000005'::uuid, 'NATURE'::text),
  ('70000000-0000-4000-8000-000000000006'::uuid, 'EXPLORATION'::text),
  ('70000000-0000-4000-8000-000000000006'::uuid, 'BEACH'::text)
) AS pref(user_id, topic_code)
JOIN topics topic ON topic.code = pref.topic_code AND topic.deleted_at IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO user_favorites (user_id, target_type, target_id) VALUES
  ('70000000-0000-4000-8000-000000000004', 'PLACE', '30000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000004', 'HOTEL', '71000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000005', 'PLACE', '30000000-0000-4000-8000-000000000005'),
  ('70000000-0000-4000-8000-000000000005', 'HOTEL', '71000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000006', 'PLACE', '30000000-0000-4000-8000-000000000007'),
  ('70000000-0000-4000-8000-000000000006', 'HOTEL', '71000000-0000-4000-8000-000000000004')
ON CONFLICT DO NOTHING;

INSERT INTO itineraries (
  id, tourist_user_id, name, description, destination_city, start_date, end_date, timezone,
  adult_count, child_count, budget, currency, status, is_ai_generated
) VALUES
  ('77000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000004', 'Da Nang & Hoi An: biển và phố cổ', 'Lịch trình 4 ngày kết hợp nghỉ biển, ẩm thực địa phương và một buổi tối ở phố cổ.', 'Đà Nẵng, Hội An', '2026-12-04', '2026-12-07', 'Asia/Ho_Chi_Minh', 2, 0, 8500000, 'VND', 'SAVED', true),
  ('77000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000005', 'Một ngày di sản ở Huế', 'Tham quan Đại Nội, ăn trưa món Huế và ngắm hoàng hôn bên sông Hương.', 'Huế', '2026-12-12', '2026-12-12', 'Asia/Ho_Chi_Minh', 2, 1, 3200000, 'VND', 'SAVED', true),
  ('77000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000006', 'Cuối tuần giữa rừng thông Đà Lạt', 'Hai ngày nghỉ chậm với quán cà phê, vườn hoa và cung đường đồi thông.', 'Đà Lạt', '2026-12-19', '2026-12-20', 'Asia/Ho_Chi_Minh', 2, 0, 5000000, 'VND', 'SAVED', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO stopovers (id, itinerary_id, place_id, stop_order, arrival_time, departure_time, description) VALUES
  ('77100000-0000-4000-8000-000000000001', '77000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 1, '2026-12-04 08:00:00+07', '2026-12-04 11:00:00+07', 'Tắm biển và ăn sáng muộn gần bãi Mỹ Khê.'),
  ('77100000-0000-4000-8000-000000000002', '77000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005', 2, '2026-12-05 15:00:00+07', '2026-12-05 21:00:00+07', 'Dạo phố cổ Hội An và ăn tối bên sông.'),
  ('77100000-0000-4000-8000-000000000003', '77000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000007', 1, '2026-12-12 08:00:00+07', '2026-12-12 12:00:00+07', 'Tham quan quần thể di tích và nghỉ trưa trong khu vực trung tâm.'),
  ('77100000-0000-4000-8000-000000000004', '77000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000010', 1, '2026-12-19 09:00:00+07', '2026-12-19 12:00:00+07', 'Khám phá khu vực đồi thông và các quán cà phê địa phương.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO activities (id, stopover_id, activity_order, name, description, start_time, end_time, estimated_cost, currency) VALUES
  ('77200000-0000-4000-8000-000000000001', '77100000-0000-4000-8000-000000000001', 1, 'Ngắm bình minh ở biển Mỹ Khê', 'Đi bộ dọc bờ biển trước khi thành phố đông khách.', '2026-12-04 08:00:00+07', '2026-12-04 09:00:00+07', 0, 'VND'),
  ('77200000-0000-4000-8000-000000000002', '77100000-0000-4000-8000-000000000001', 2, 'Thưởng thức mì Quảng', 'Dùng bữa sáng muộn tại quán địa phương gần bãi biển.', '2026-12-04 09:30:00+07', '2026-12-04 11:00:00+07', 180000, 'VND'),
  ('77200000-0000-4000-8000-000000000003', '77100000-0000-4000-8000-000000000002', 1, 'Dạo phố đèn lồng', 'Tham quan các tuyến phố đi bộ và nhà cổ.', '2026-12-05 15:00:00+07', '2026-12-05 18:00:00+07', 120000, 'VND'),
  ('77200000-0000-4000-8000-000000000004', '77100000-0000-4000-8000-000000000002', 2, 'Ăn tối bên sông Hoài', 'Thử các món địa phương trong khu phố cổ.', '2026-12-05 18:30:00+07', '2026-12-05 21:00:00+07', 450000, 'VND'),
  ('77200000-0000-4000-8000-000000000005', '77100000-0000-4000-8000-000000000003', 1, 'Tham quan Đại Nội', 'Dành buổi sáng khám phá các công trình trong Hoàng thành.', '2026-12-12 08:00:00+07', '2026-12-12 12:00:00+07', 400000, 'VND'),
  ('77200000-0000-4000-8000-000000000006', '77100000-0000-4000-8000-000000000004', 1, 'Cà phê giữa đồi thông', 'Thưởng thức cà phê rang tại chỗ và ngắm thung lũng.', '2026-12-19 09:00:00+07', '2026-12-19 11:00:00+07', 220000, 'VND')
ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (id, user_id, type, title, message, link, event_key, created_at) VALUES
  ('79000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000004', 'BOOKING_UPDATE', 'Chuyến đi Đà Nẵng sắp tới', 'Lịch trình demo của bạn đã sẵn sàng để xem lại.', '/account/itineraries', 'DEMO-SEED-ITINERARY-MINH', now() - interval '2 days'),
  ('79000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000005', 'BOOKING_UPDATE', 'Gợi ý cuối tuần ở Huế', 'Lịch trình di sản Huế đã được lưu trong tài khoản của bạn.', '/account/itineraries', 'DEMO-SEED-ITINERARY-LAN', now() - interval '1 day'),
  ('79000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000002', 'HOTEL_UPDATE', 'Báo cáo đặt phòng tháng này', 'Có các đơn demo mới trong bảng điều khiển khách sạn.', '/owner/bookings', 'DEMO-SEED-OWNER-DANANG', now() - interval '3 hours'),
  ('79000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000003', 'HOTEL_UPDATE', 'Danh sách phòng đã cập nhật', 'Thông tin phòng demo đã sẵn sàng để xem.', '/owner/rooms', 'DEMO-SEED-OWNER-HOIAN', now() - interval '5 hours')
ON CONFLICT (id) DO NOTHING;

COMMIT;
