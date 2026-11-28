-- Additive demo seed for hotel-owner settlement screens.
-- All generated payment references and bank details are synthetic. This script
-- does not call a payment provider and never creates a real or sandbox provider transaction.
-- Re-running it keeps the same tagged rows and does not duplicate them.
-- PowerShell: Get-Content -Raw be/src/database/seed-settlement-demo.sql |
--   docker compose exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

BEGIN;

CREATE FUNCTION pg_temp.demo_uuid(seed text)
RETURNS uuid
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  SELECT (
    substr(hash, 1, 8) || '-' || substr(hash, 9, 4) || '-4' ||
    substr(hash, 14, 3) || '-8' || substr(hash, 18, 3) || '-' ||
    substr(hash, 21, 12)
  )::uuid
  FROM (SELECT md5(seed) AS hash) digest;
$$;

CREATE TEMP TABLE demo_settlement_hotels ON COMMIT DROP AS
WITH hotel_candidates AS (
  SELECT
    h.id AS hotel_id,
    h.owner_user_id,
    h.name AS hotel_name,
    count(r.id)::integer AS room_count,
    EXISTS (
      SELECT 1
      FROM bookings seeded
      WHERE seeded.hotel_id = h.id
        AND seeded.booking_code LIKE 'DEMO-SETTLE-%'
    ) AS already_seeded
  FROM hotels h
  JOIN hotel_owners ho ON ho.user_id = h.owner_user_id
  JOIN rooms r
    ON r.hotel_id = h.id
   AND r.deleted_at IS NULL
   AND r.operational_status = 'AVAILABLE'
   AND r.price_per_night > 0
   AND r.max_occupancy >= 2
  WHERE h.status = 'ACTIVE'
    AND ho.deleted_at IS NULL
    AND (
      (ho.bank_name IS NULL AND ho.bank_account_number IS NULL AND ho.bank_account_holder IS NULL)
      OR (
        ho.bank_name = 'DEMO ONLY - SANDBOX'
        AND ho.bank_account_number LIKE 'DEMO-NO-REAL-%'
        AND ho.bank_account_holder LIKE 'DEMO ONLY - HOST %'
      )
      OR EXISTS (
        SELECT 1
        FROM bookings seeded
        WHERE seeded.hotel_id = h.id
          AND seeded.booking_code LIKE 'DEMO-SETTLE-%'
      )
    )
  GROUP BY h.id, h.owner_user_id, h.name
), one_hotel_per_owner AS (
  SELECT DISTINCT ON (owner_user_id) *
  FROM hotel_candidates
  ORDER BY owner_user_id, already_seeded DESC, room_count DESC, hotel_id
), ranked AS (
  SELECT
    row_number() OVER (ORDER BY already_seeded DESC, room_count DESC, hotel_id)::integer AS slot,
    *
  FROM one_hotel_per_owner
)
SELECT
  slot,
  hotel_id,
  owner_user_id,
  hotel_name,
  'DEMO ONLY - SANDBOX'::varchar(150) AS bank_name,
  ('DEMO-NO-REAL-' || upper(substr(owner_user_id::text, 1, 8)))::varchar(50) AS bank_account_number,
  ('DEMO ONLY - HOST ' || upper(substr(owner_user_id::text, 1, 8)))::varchar(150) AS bank_account_holder
FROM ranked
WHERE slot <= 2;

DO $$
BEGIN
  IF (SELECT count(*) FROM demo_settlement_hotels) <> 2 THEN
    RAISE EXCEPTION 'Settlement demo seed requires two active hotels with available rooms and blank or already seeded owner bank profiles.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM demo_settlement_hotels ds
    JOIN hotel_owners ho ON ho.user_id = ds.owner_user_id
    WHERE EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.hotel_id = ds.hotel_id AND b.booking_code LIKE 'DEMO-SETTLE-%'
    )
      AND NOT (
        ho.bank_name = 'DEMO ONLY - SANDBOX'
        AND ho.bank_account_number LIKE 'DEMO-NO-REAL-%'
        AND ho.bank_account_holder LIKE 'DEMO ONLY - HOST %'
      )
  ) THEN
    RAISE EXCEPTION 'A previously seeded owner profile was edited; refusing to replace or snapshot non-demo bank details.';
  END IF;
END $$;

UPDATE hotel_owners ho
SET bank_name = ds.bank_name,
    bank_account_number = ds.bank_account_number,
    bank_account_holder = ds.bank_account_holder,
    updated_at = now()
FROM demo_settlement_hotels ds
WHERE ho.user_id = ds.owner_user_id
  AND (
    (ho.bank_name IS NULL AND ho.bank_account_number IS NULL AND ho.bank_account_holder IS NULL)
    OR (
      ho.bank_name = 'DEMO ONLY - SANDBOX'
      AND ho.bank_account_number LIKE 'DEMO-NO-REAL-%'
      AND ho.bank_account_holder LIKE 'DEMO ONLY - HOST %'
    )
  );

CREATE TEMP TABLE demo_settlement_actors ON COMMIT DROP AS
SELECT
  (SELECT id FROM users WHERE role = 'TOURIST' AND status = 'ACTIVE' AND deleted_at IS NULL ORDER BY created_at, id LIMIT 1) AS tourist_id,
  (SELECT id FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE' AND deleted_at IS NULL ORDER BY created_at, id LIMIT 1) AS admin_id;

DO $$
BEGIN
  IF (SELECT tourist_id IS NULL OR admin_id IS NULL FROM demo_settlement_actors) THEN
    RAISE EXCEPTION 'Settlement demo seed requires one active tourist and one active admin account.';
  END IF;
END $$;

CREATE TEMP TABLE demo_settlement_rooms ON COMMIT DROP AS
SELECT
  r.id AS room_id,
  r.hotel_id,
  row_number() OVER (PARTITION BY r.hotel_id ORDER BY r.room_number, r.id)::integer AS room_rank,
  count(*) OVER (PARTITION BY r.hotel_id)::integer AS room_count,
  r.room_number,
  r.room_type,
  r.max_occupancy,
  r.price_per_night,
  r.currency
FROM rooms r
JOIN demo_settlement_hotels ds ON ds.hotel_id = r.hotel_id
WHERE r.deleted_at IS NULL
  AND r.operational_status = 'AVAILABLE'
  AND r.price_per_night > 0
  AND r.max_occupancy >= 2;

CREATE TEMP TABLE demo_settlement_booking_seed ON COMMIT DROP AS
WITH generated AS (
  SELECT 1 AS hotel_slot, 'PAID_MAY_A'::text AS scenario, g.seq, date '2026-05-01' + (g.seq - 1) AS check_out_date,
         'COMPLETED'::text AS booking_status, 'PAID'::text AS payment_status, 'NONE'::text AS refund_status, 'SETTLED'::text AS settlement_status
  FROM generate_series(1, 5) AS g(seq)
  UNION ALL
  SELECT 1, 'DRAFT_AUG_A', g.seq, date '2026-08-01' + (g.seq - 1), 'COMPLETED', 'PAID', 'NONE', 'PENDING'
  FROM generate_series(1, 5) AS g(seq)
  UNION ALL
  SELECT 1, 'APPROVED_SEP_A', g.seq, date '2026-09-01' + (g.seq - 1), 'COMPLETED', 'PAID', 'NONE', 'PENDING'
  FROM generate_series(1, 5) AS g(seq)
  UNION ALL
  SELECT 1, 'FLOW_OCT_A', g.seq, date '2026-10-01' + (g.seq - 1), 'COMPLETED', 'PAID', 'NONE', 'PENDING'
  FROM generate_series(1, 10) AS g(seq)
  UNION ALL
  SELECT 1, 'FILTER_UNPAID_A', g.seq, date '2026-10-11' + (g.seq - 1), 'PENDING', 'PAYMENT_PENDING', 'NONE', 'PENDING'
  FROM generate_series(1, 3) AS g(seq)
  UNION ALL
  SELECT 1, 'FILTER_REFUNDED_A', g.seq, date '2026-10-14' + (g.seq - 1), 'CANCELLED', 'PAID', 'REFUNDED', 'PENDING'
  FROM generate_series(1, 3) AS g(seq)
  UNION ALL
  SELECT 1, 'FILTER_CONFIRMED_A', g.seq, date '2026-10-17' + (g.seq - 1), 'CONFIRMED', 'PAID', 'NONE', 'PENDING'
  FROM generate_series(1, 2) AS g(seq)
  UNION ALL
  SELECT 1, 'FILTER_EXPIRED_A', g.seq, date '2026-10-19' + (g.seq - 1), 'CANCELLED', 'EXPIRED', 'NONE', 'PENDING'
  FROM generate_series(1, 2) AS g(seq)
  UNION ALL
  SELECT 2, 'PAID_JUNE_B', g.seq, date '2026-06-01' + (g.seq - 1), 'COMPLETED', 'PAID', 'NONE', 'SETTLED'
  FROM generate_series(1, 5) AS g(seq)
  UNION ALL
  SELECT 2, 'DRAFT_AUG_B', g.seq, date '2026-08-11' + (g.seq - 1), 'COMPLETED', 'PAID', 'NONE', 'PENDING'
  FROM generate_series(1, 5) AS g(seq)
  UNION ALL
  SELECT 2, 'APPROVED_SEP_B', g.seq, date '2026-09-11' + (g.seq - 1), 'COMPLETED', 'PAID', 'NONE', 'PENDING'
  FROM generate_series(1, 5) AS g(seq)
  UNION ALL
  SELECT 2, 'FLOW_OCT_B', g.seq, date '2026-10-11' + (g.seq - 1), 'COMPLETED', 'PAID', 'NONE', 'PENDING'
  FROM generate_series(1, 10) AS g(seq)
), with_rooms AS (
  SELECT
    g.*,
    ds.hotel_id,
    ds.owner_user_id,
    ds.hotel_name,
    ds.bank_name,
    ds.bank_account_number,
    ds.bank_account_holder,
    r.room_id,
    r.room_number,
    r.room_type,
    r.max_occupancy,
    r.price_per_night,
    r.currency AS room_currency,
    (1 + (g.seq % 3))::integer AS nights,
    CASE WHEN g.seq % 3 = 0 THEN 15.00 WHEN g.seq % 3 = 1 THEN 10.00 ELSE 12.50 END::numeric(5,2) AS commission_rate
  FROM generated g
  JOIN demo_settlement_hotels ds ON ds.slot = g.hotel_slot
  JOIN demo_settlement_rooms r
    ON r.hotel_id = ds.hotel_id
   AND r.room_rank = ((g.seq - 1) % r.room_count) + 1
)
SELECT
  *,
  (price_per_night * nights)::numeric(12,2) AS amount,
  (check_out_date - nights) AS check_in_date,
  ('DEMO-SETTLE-' || scenario || '-' || lpad(seq::text, 2, '0'))::varchar(50) AS booking_code
FROM with_rooms;

INSERT INTO bookings (
  id, hotel_id, tourist_id, booking_code, created_at, updated_at,
  check_in_date, check_out_date, adult_count, child_count,
  guest_name, guest_email, guest_phone,
  booking_status, reservation_expires_at,
  total_amount, currency, applied_commission_rate, amount,
  payment_method, payment_created_at, payment_status, paid_at, payment_transaction_id,
  settlement_status,
  refund_amount, refund_reason, refund_status, refunded_at, refund_transaction_id, refund_attempt,
  cancelled_at
)
SELECT
  pg_temp.demo_uuid(s.booking_code),
  s.hotel_id,
  a.tourist_id,
  s.booking_code,
  (s.check_in_date - 30)::timestamptz,
  now(),
  s.check_in_date,
  s.check_out_date,
  2,
  0,
  ('Demo Guest ' || s.scenario || ' ' || lpad(s.seq::text, 2, '0')),
  ('demo+' || lower(s.booking_code) || '@example.test'),
  ('090000' || lpad(s.seq::text, 4, '0')),
  s.booking_status,
  s.check_in_date::timestamptz,
  s.amount,
  s.room_currency,
  s.commission_rate,
  s.amount,
  CASE WHEN s.payment_status = 'PAID' THEN 'BANK_TRANSFER' ELSE NULL END,
  (s.check_in_date - 30)::timestamptz,
  s.payment_status,
  CASE WHEN s.payment_status = 'PAID' THEN (s.check_out_date::timestamptz) ELSE NULL END,
  CASE WHEN s.payment_status = 'PAID' THEN ('DEMO-PAY-' || s.booking_code) ELSE NULL END,
  CASE WHEN s.settlement_status = 'SETTLED' THEN 'PENDING' ELSE s.settlement_status END,
  CASE WHEN s.refund_status = 'REFUNDED' THEN s.amount ELSE NULL END,
  CASE WHEN s.refund_status = 'REFUNDED' THEN 'DEMO DATA ONLY - synthetic refunded booking' ELSE NULL END,
  s.refund_status,
  CASE WHEN s.refund_status = 'REFUNDED' THEN (s.check_out_date::timestamptz) ELSE NULL END,
  CASE WHEN s.refund_status = 'REFUNDED' THEN ('DEMO-REFUND-' || s.booking_code) ELSE NULL END,
  CASE WHEN s.refund_status = 'REFUNDED' THEN 1 ELSE 0 END,
  CASE WHEN s.booking_status = 'CANCELLED' THEN (s.check_out_date::timestamptz) ELSE NULL END
FROM demo_settlement_booking_seed s
CROSS JOIN demo_settlement_actors a
ON CONFLICT (booking_code) DO NOTHING;

INSERT INTO booking_rooms (
  id, booking_id, room_id, room_number_snapshot, room_type_snapshot,
  max_occupancy_snapshot, price_per_night, currency, number_of_nights, subtotal,
  adult_count
)
SELECT
  pg_temp.demo_uuid(s.booking_code || '-ROOM'),
  pg_temp.demo_uuid(s.booking_code),
  s.room_id,
  s.room_number,
  s.room_type,
  s.max_occupancy,
  s.price_per_night,
  s.room_currency,
  s.nights,
  s.amount,
  2
FROM demo_settlement_booking_seed s
ON CONFLICT (booking_id, room_id) DO NOTHING;

CREATE TEMP TABLE demo_settlement_batch_seed ON COMMIT DROP AS
WITH groups AS (
  SELECT * FROM (VALUES
    ('PAID_MAY_A'::text, 1, date '2026-05-01', date '2026-05-31', 'PAID'::text),
    ('DRAFT_AUG_A'::text, 1, date '2026-08-01', date '2026-08-31', 'DRAFT'::text),
    ('APPROVED_SEP_A'::text, 1, date '2026-09-01', date '2026-09-30', 'APPROVED'::text),
    ('PAID_JUNE_B'::text, 2, date '2026-06-01', date '2026-06-30', 'PAID'::text),
    ('DRAFT_AUG_B'::text, 2, date '2026-08-01', date '2026-08-31', 'DRAFT'::text),
    ('APPROVED_SEP_B'::text, 2, date '2026-09-01', date '2026-09-30', 'APPROVED'::text)
  ) AS v(scenario, hotel_slot, period_start, period_end, status)
)
SELECT
  g.scenario,
  ds.hotel_id,
  ds.hotel_name AS hotel_name_snapshot,
  ds.owner_user_id,
  g.period_start,
  g.period_end,
  'VND'::varchar(10) AS currency,
  count(s.booking_code)::integer AS booking_count,
  sum(s.amount)::numeric(14,2) AS gross_amount,
  sum(round(s.amount * s.commission_rate / 100, 2))::numeric(14,2) AS commission_amount,
  (sum(s.amount) - sum(round(s.amount * s.commission_rate / 100, 2)))::numeric(14,2) AS net_amount,
  g.status,
  ds.bank_name AS bank_name_snapshot,
  ds.bank_account_number AS bank_account_number_snapshot,
  ds.bank_account_holder AS bank_account_holder_snapshot,
  a.admin_id AS admin_id,
  CASE WHEN g.status = 'PAID' THEN ('DEMO-SEED-REF-' || g.scenario) ELSE NULL END::varchar(255) AS transfer_reference,
  CASE WHEN g.status = 'PAID' THEN ('DEMO-SEED-PROVIDER-' || g.scenario) ELSE NULL END::varchar(255) AS provider_transfer_id,
  CASE WHEN g.status IN ('APPROVED', 'PAID') THEN (g.period_end + time '12:00')::timestamptz ELSE NULL END AS approved_at,
  CASE WHEN g.status = 'PAID' THEN (g.period_end + time '14:00')::timestamptz ELSE NULL END AS paid_at
FROM groups g
JOIN demo_settlement_hotels ds ON ds.slot = g.hotel_slot
JOIN demo_settlement_actors a ON true
JOIN demo_settlement_booking_seed s ON s.scenario = g.scenario AND s.hotel_id = ds.hotel_id
GROUP BY g.scenario, ds.hotel_id, ds.hotel_name, ds.owner_user_id, g.period_start, g.period_end, g.status,
         ds.bank_name, ds.bank_account_number, ds.bank_account_holder, a.admin_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM demo_settlement_batch_seed seed
    JOIN settlement_batches existing
      ON existing.hotel_id = seed.hotel_id
     AND existing.period_start = seed.period_start
     AND existing.period_end = seed.period_end
    WHERE existing.id <> pg_temp.demo_uuid('DEMO-SETTLEMENT-' || seed.scenario || '-' || seed.hotel_id::text)
  ) THEN
    RAISE EXCEPTION 'A demo settlement period already belongs to a non-demo batch; refusing to overlap it.';
  END IF;
END $$;

INSERT INTO settlement_batches (
  id, hotel_id, hotel_name_snapshot, owner_user_id, period_start, period_end, currency,
  booking_count, gross_amount, commission_amount, adjustment_amount, net_amount, status,
  bank_name_snapshot, bank_account_number_snapshot, bank_account_holder_snapshot,
  approved_by, approved_at, paid_at, transfer_reference, transfer_mode, provider_transfer_id,
  revision, created_at, updated_at
)
SELECT
  pg_temp.demo_uuid('DEMO-SETTLEMENT-' || s.scenario || '-' || s.hotel_id::text),
  s.hotel_id, s.hotel_name_snapshot, s.owner_user_id, s.period_start, s.period_end, s.currency,
  s.booking_count, s.gross_amount, s.commission_amount, 0, s.net_amount, s.status,
  s.bank_name_snapshot, s.bank_account_number_snapshot, s.bank_account_holder_snapshot,
  CASE WHEN s.status IN ('APPROVED', 'PAID') THEN s.admin_id ELSE NULL END,
  s.approved_at,
  s.paid_at,
  s.transfer_reference,
  CASE WHEN s.status = 'PAID' THEN 'LEGACY_SIMULATED' ELSE 'MANUAL' END,
  s.provider_transfer_id,
  CASE WHEN s.status = 'DRAFT' THEN 1 WHEN s.status = 'APPROVED' THEN 2 ELSE 3 END,
  now(), now()
FROM demo_settlement_batch_seed s
ON CONFLICT DO NOTHING;

INSERT INTO settlement_items (
  id, settlement_batch_id, booking_id, booking_code_snapshot, check_out_date_snapshot,
  payment_reference_snapshot, currency_snapshot, gross_amount, commission_rate_snapshot,
  commission_amount, net_amount
)
SELECT
  pg_temp.demo_uuid('DEMO-SETTLEMENT-ITEM-' || s.scenario || '-' || b.booking_code),
  pg_temp.demo_uuid('DEMO-SETTLEMENT-' || s.scenario || '-' || s.hotel_id::text),
  pg_temp.demo_uuid(b.booking_code),
  b.booking_code,
  b.check_out_date,
  ('DEMO-PAY-' || b.booking_code),
  s.currency,
  b.amount,
  b.commission_rate,
  round(b.amount * b.commission_rate / 100, 2),
  b.amount - round(b.amount * b.commission_rate / 100, 2)
FROM demo_settlement_batch_seed s
JOIN demo_settlement_booking_seed b ON b.scenario = s.scenario AND b.hotel_id = s.hotel_id
ON CONFLICT DO NOTHING;

UPDATE bookings b
SET settlement_base_amount = b.amount,
    commission_amount = round(b.amount * b.applied_commission_rate / 100, 2),
    partner_receivable_amount = b.amount - round(b.amount * b.applied_commission_rate / 100, 2),
    transaction_id = s.transfer_reference,
    bank_name_snapshot = s.bank_name_snapshot,
    bank_account_number_snapshot = s.bank_account_number_snapshot,
    bank_account_holder_snapshot = s.bank_account_holder_snapshot,
    settlement_status = 'SETTLED',
    settled_at = s.paid_at,
    updated_at = now()
FROM demo_settlement_batch_seed s
JOIN demo_settlement_booking_seed seed ON seed.scenario = s.scenario AND seed.hotel_id = s.hotel_id
WHERE s.status = 'PAID'
  AND b.id = pg_temp.demo_uuid(seed.booking_code)
  AND b.booking_code LIKE 'DEMO-SETTLE-%'
  AND b.settlement_status = 'PENDING';

INSERT INTO settlement_batch_events (
  id, settlement_batch_id, from_status, to_status, actor_user_id, note, transfer_reference, created_at
)
SELECT
  pg_temp.demo_uuid('DEMO-SETTLEMENT-EVENT-' || seed.scenario || '-' || ev.step),
  pg_temp.demo_uuid('DEMO-SETTLEMENT-' || seed.scenario || '-' || seed.hotel_id::text),
  ev.from_status,
  ev.to_status,
  seed.admin_id,
  ev.note,
  CASE WHEN ev.to_status = 'PAID' THEN seed.transfer_reference ELSE NULL END,
  coalesce(ev.event_at, now())
FROM demo_settlement_batch_seed seed
CROSS JOIN LATERAL (
  VALUES
    (1, NULL::text, 'DRAFT'::text, 'DEMO-SEED: synthetic settlement batch created for presentation.', NULL::timestamptz),
    (2, 'DRAFT'::text, 'APPROVED'::text, 'DEMO-SEED: sample batch approved for presentation.', seed.approved_at),
    (3, 'APPROVED'::text, 'PROCESSING'::text, 'DEMO-SEED: synthetic payout-processing step; no provider transaction was created.', seed.paid_at),
    (4, 'PROCESSING'::text, 'PAID'::text, 'DEMO-SEED ONLY: seeded paid display state; no provider transaction or money movement was created.', seed.paid_at)
) AS ev(step, from_status, to_status, note, event_at)
WHERE (seed.status = 'DRAFT' AND ev.step = 1)
   OR (seed.status = 'APPROVED' AND ev.step IN (1, 2))
   OR (seed.status = 'PAID' AND ev.step IN (1, 2, 3, 4))
ON CONFLICT (id) DO NOTHING;

COMMIT;
