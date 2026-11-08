-- Complete PostgreSQL schema v1.
-- Requires PostgreSQL 13+ with PostGIS and btree_gist available.
-- Provider search results are inserted into places only after selection or curation.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar(50) NOT NULL,
    email varchar(254) NOT NULL,
    password_hash varchar(255),
    google_account_id text,
    first_name varchar(100),
    last_name varchar(100),
    display_name varchar(150),
    phone_number varchar(20),
    date_of_birth date,
    gender varchar(20),
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    role varchar(20) NOT NULL DEFAULT 'TOURIST',
    is_email_verified boolean NOT NULL DEFAULT false,
    is_two_factor_enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_users_username_format
        CHECK (username ~ '^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$'),
    CONSTRAINT chk_users_email_nonempty CHECK (btrim(email) <> ''),
    CONSTRAINT chk_users_auth_method
        CHECK (password_hash IS NOT NULL OR google_account_id IS NOT NULL),
    CONSTRAINT chk_users_phone_format
        CHECK (phone_number IS NULL OR phone_number ~ '^\+?[0-9]{8,15}$'),
    CONSTRAINT chk_users_gender
        CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED')),
    CONSTRAINT chk_users_status
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DEACTIVATED')),
    CONSTRAINT chk_users_role CHECK (role IN ('TOURIST', 'HOTEL_OWNER', 'ADMIN')),
    CONSTRAINT chk_users_soft_delete_status
        CHECK (deleted_at IS NULL OR status = 'DEACTIVATED')
);

CREATE UNIQUE INDEX uq_users_username_active
    ON users (lower(username)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_users_email_active
    ON users (lower(email)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_users_phone_active
    ON users (phone_number)
    WHERE phone_number IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_users_google_account
    ON users (google_account_id) WHERE google_account_id IS NOT NULL;
CREATE INDEX idx_users_active_role
    ON users (role, status) WHERE deleted_at IS NULL;

CREATE TABLE tourists (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
    bio text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE TABLE hotel_owners (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
    bank_name varchar(150),
    bank_account_number varchar(50),
    bank_account_holder varchar(150),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_hotel_owners_bank_name
        CHECK (bank_name IS NULL OR btrim(bank_name) <> ''),
    CONSTRAINT chk_hotel_owners_account_number
        CHECK (bank_account_number IS NULL OR btrim(bank_account_number) <> ''),
    CONSTRAINT chk_hotel_owners_account_holder
        CHECK (bank_account_holder IS NULL OR btrim(bank_account_holder) <> '')
);

CREATE TABLE images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url text NOT NULL,
    alt_text varchar(255),
    source_provider varchar(50),
    source_url text,
    attribution_text text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_images_url_nonempty CHECK (btrim(image_url) <> ''),
    CONSTRAINT chk_images_source_provider
        CHECK (source_provider IS NULL OR btrim(source_provider) <> '')
);

CREATE UNIQUE INDEX uq_images_url_active
    ON images (image_url) WHERE deleted_at IS NULL;

CREATE TABLE user_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    image_id uuid NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
    image_type varchar(30) NOT NULL DEFAULT 'AVATAR',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_user_images_type CHECK (image_type IN ('AVATAR', 'PROFILE'))
);

CREATE UNIQUE INDEX uq_user_images_active_type
    ON user_images (user_id, image_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_images_active_image
    ON user_images (image_id) WHERE deleted_at IS NULL;

CREATE TABLE topics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL,
    name varchar(120) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_topics_code_format
        CHECK (code ~ '^[A-Z0-9]+(_[A-Z0-9]+)*$'),
    CONSTRAINT chk_topics_name_nonempty CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX uq_topics_code_active
    ON topics (code) WHERE deleted_at IS NULL;

CREATE TABLE travel_preferences (
    user_id uuid PRIMARY KEY REFERENCES tourists(user_id) ON DELETE RESTRICT,
    min_budget numeric(14,2),
    max_budget numeric(14,2),
    currency char(3) NOT NULL DEFAULT 'VND',
    preferred_duration_days integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_travel_preferences_budget
        CHECK (
            (min_budget IS NULL OR min_budget >= 0) AND
            (max_budget IS NULL OR max_budget >= 0) AND
            (min_budget IS NULL OR max_budget IS NULL OR max_budget >= min_budget)
        ),
    CONSTRAINT chk_travel_preferences_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_travel_preferences_duration
        CHECK (preferred_duration_days IS NULL OR preferred_duration_days > 0)
);

CREATE TABLE travel_preference_topics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    travel_preference_user_id uuid NOT NULL
        REFERENCES travel_preferences(user_id) ON DELETE RESTRICT,
    topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE UNIQUE INDEX uq_travel_preference_topics_active
    ON travel_preference_topics (travel_preference_user_id, topic_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_travel_preference_topics_active_topic
    ON travel_preference_topics (topic_id, travel_preference_user_id)
    WHERE deleted_at IS NULL;

CREATE TABLE place_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL,
    name varchar(120) NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_place_categories_code
        CHECK (code ~ '^[A-Z0-9]+(_[A-Z0-9]+)*$'),
    CONSTRAINT chk_place_categories_name CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX uq_place_categories_code_active
    ON place_categories (code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_place_categories_name_active
    ON place_categories (lower(name)) WHERE deleted_at IS NULL;

-- places is a sparse local catalogue: curated/crawled places plus provider
-- results selected by users. Search results not selected by users stay external.
CREATE TABLE places (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(200) NOT NULL,
    description text,
    address varchar(500),
    country_code char(2),
    province_code varchar(20),
    timezone varchar(100),
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    location geography(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(
            ST_MakePoint(longitude::double precision, latitude::double precision),
            4326
        )::geography
    ) STORED,
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    average_rating numeric(3,2),
    opening_times jsonb,
    source_type varchar(20) NOT NULL DEFAULT 'MANUAL',
    source_provider varchar(50),
    provider_place_id text,
    source_url text,
    attribution_text text,
    license_code varchar(50),
    last_refreshed_at timestamptz,
    search_document tsvector GENERATED ALWAYS AS (
        to_tsvector(
            'simple',
            name || ' ' || coalesce(description, '') || ' ' ||
            coalesce(address, '') || ' ' || coalesce(province_code, '')
        )
    ) STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_places_name CHECK (btrim(name) <> ''),
    CONSTRAINT chk_places_country_code
        CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
    CONSTRAINT chk_places_province_code
        CHECK (province_code IS NULL OR province_code ~ '^[A-Z0-9-]{1,20}$'),
    CONSTRAINT chk_places_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_places_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_places_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT chk_places_rating
        CHECK (average_rating IS NULL OR average_rating BETWEEN 0 AND 5),
    CONSTRAINT chk_places_opening_times
        CHECK (opening_times IS NULL OR jsonb_typeof(opening_times) IN ('object', 'array')),
    CONSTRAINT chk_places_source_type
        CHECK (source_type IN ('MANUAL', 'CRAWLED', 'PROVIDER')),
    CONSTRAINT chk_places_source_provider
        CHECK (source_provider IS NULL OR btrim(source_provider) <> ''),
    CONSTRAINT chk_places_provider_place_id
        CHECK (provider_place_id IS NULL OR btrim(provider_place_id) <> ''),
    CONSTRAINT chk_places_provider_source
        CHECK (
            source_type <> 'PROVIDER' OR
            (source_provider IS NOT NULL AND provider_place_id IS NOT NULL)
        ),
    CONSTRAINT chk_places_crawled_source
        CHECK (
            source_type <> 'CRAWLED' OR
            (source_provider IS NOT NULL AND source_url IS NOT NULL)
        ),
    CONSTRAINT chk_places_provider_pair
        CHECK (provider_place_id IS NULL OR source_provider IS NOT NULL)
);

CREATE UNIQUE INDEX uq_places_provider_identity
    ON places (lower(source_provider), provider_place_id)
    WHERE provider_place_id IS NOT NULL;
CREATE INDEX idx_places_active_region
    ON places (country_code, province_code)
    WHERE deleted_at IS NULL AND status = 'ACTIVE';
CREATE INDEX idx_places_active_search
    ON places USING gin (search_document)
    WHERE deleted_at IS NULL AND status = 'ACTIVE';
CREATE INDEX idx_places_active_location
    ON places USING gist (location)
    WHERE deleted_at IS NULL AND status = 'ACTIVE';

CREATE TABLE place_category_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
    place_category_id uuid NOT NULL REFERENCES place_categories(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE UNIQUE INDEX uq_place_category_mappings_active
    ON place_category_mappings (place_id, place_category_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_place_category_mappings_active_category
    ON place_category_mappings (place_category_id, place_id)
    WHERE deleted_at IS NULL;

CREATE TABLE place_topics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
    topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE UNIQUE INDEX uq_place_topics_active
    ON place_topics (place_id, topic_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_place_topics_active_topic
    ON place_topics (topic_id, place_id) WHERE deleted_at IS NULL;

CREATE TABLE place_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
    image_id uuid NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
    image_order integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_place_images_order CHECK (image_order > 0)
);

CREATE UNIQUE INDEX uq_place_images_active_image
    ON place_images (place_id, image_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_place_images_active_order
    ON place_images (place_id, image_order) WHERE deleted_at IS NULL;

CREATE TABLE reference_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
    cost_type varchar(60) NOT NULL,
    min_price numeric(14,2) NOT NULL,
    max_price numeric(14,2) NOT NULL,
    currency char(3) NOT NULL DEFAULT 'VND',
    pricing_unit varchar(60) NOT NULL,
    description text,
    price_source varchar(255),
    confidence_score numeric(4,3),
    valid_from date,
    valid_until date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_reference_prices_cost_type CHECK (btrim(cost_type) <> ''),
    CONSTRAINT chk_reference_prices_range CHECK (min_price >= 0 AND max_price >= min_price),
    CONSTRAINT chk_reference_prices_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_reference_prices_unit CHECK (btrim(pricing_unit) <> ''),
    CONSTRAINT chk_reference_prices_confidence
        CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
    CONSTRAINT chk_reference_prices_validity
        CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE INDEX idx_reference_prices_active_place_type
    ON reference_prices (place_id, cost_type, valid_from DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE amenities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL,
    name varchar(120) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_amenities_code
        CHECK (code ~ '^[A-Z0-9]+(_[A-Z0-9]+)*$'),
    CONSTRAINT chk_amenities_name CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX uq_amenities_code_active
    ON amenities (code) WHERE deleted_at IS NULL;

CREATE TABLE hotels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
    hotel_owner_user_id uuid NOT NULL REFERENCES hotel_owners(user_id) ON DELETE RESTRICT,
    star_rating smallint,
    contact_email varchar(254),
    contact_phone varchar(20),
    contact_person varchar(150),
    operational_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
    approval_status varchar(30) NOT NULL DEFAULT 'PENDING',
    default_commission_rate numeric(5,2) NOT NULL DEFAULT 0,
    approved_at timestamptz,
    approved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
    rejection_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_hotels_star_rating
        CHECK (star_rating IS NULL OR star_rating BETWEEN 1 AND 5),
    CONSTRAINT chk_hotels_contact_phone
        CHECK (contact_phone IS NULL OR contact_phone ~ '^\+?[0-9]{8,15}$'),
    CONSTRAINT chk_hotels_operational_status
        CHECK (operational_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    CONSTRAINT chk_hotels_approval_status
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_INFO')),
    CONSTRAINT chk_hotels_commission
        CHECK (default_commission_rate BETWEEN 0 AND 100),
    CONSTRAINT chk_hotels_approval_fields
        CHECK (
            approval_status <> 'APPROVED' OR
            (approved_at IS NOT NULL AND approved_by IS NOT NULL)
        ),
    CONSTRAINT chk_hotels_rejection_reason
        CHECK (
            approval_status <> 'REJECTED' OR
            (rejection_reason IS NOT NULL AND btrim(rejection_reason) <> '')
        )
);

CREATE UNIQUE INDEX uq_hotels_place_active
    ON hotels (place_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hotels_active_owner
    ON hotels (hotel_owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hotels_active_catalog
    ON hotels (approval_status, operational_status, star_rating)
    WHERE deleted_at IS NULL;

CREATE TABLE hotel_amenities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
    amenity_id uuid NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE UNIQUE INDEX uq_hotel_amenities_active
    ON hotel_amenities (hotel_id, amenity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hotel_amenities_active_amenity
    ON hotel_amenities (amenity_id, hotel_id) WHERE deleted_at IS NULL;

CREATE TABLE rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
    room_number varchar(30) NOT NULL,
    max_occupancy integer NOT NULL,
    price_per_night numeric(14,2) NOT NULL,
    currency char(3) NOT NULL DEFAULT 'VND',
    description text,
    operational_status varchar(30) NOT NULL DEFAULT 'AVAILABLE',
    room_type varchar(60) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT uq_rooms_id_hotel UNIQUE (id, hotel_id),
    CONSTRAINT chk_rooms_number CHECK (btrim(room_number) <> ''),
    CONSTRAINT chk_rooms_occupancy CHECK (max_occupancy BETWEEN 1 AND 100),
    CONSTRAINT chk_rooms_price CHECK (price_per_night >= 0),
    CONSTRAINT chk_rooms_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_rooms_status
        CHECK (operational_status IN ('AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE')),
    CONSTRAINT chk_rooms_type CHECK (btrim(room_type) <> '')
);

CREATE UNIQUE INDEX uq_rooms_hotel_number_active
    ON rooms (hotel_id, room_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_rooms_active_hotel_status
    ON rooms (hotel_id, operational_status, max_occupancy, price_per_night)
    WHERE deleted_at IS NULL;

CREATE TABLE room_amenities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    amenity_id uuid NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE UNIQUE INDEX uq_room_amenities_active
    ON room_amenities (room_id, amenity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_room_amenities_active_amenity
    ON room_amenities (amenity_id, room_id) WHERE deleted_at IS NULL;

CREATE TABLE hotel_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
    image_id uuid NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
    image_order integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_hotel_images_order CHECK (image_order > 0)
);

CREATE UNIQUE INDEX uq_hotel_images_active_image
    ON hotel_images (hotel_id, image_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_hotel_images_active_order
    ON hotel_images (hotel_id, image_order) WHERE deleted_at IS NULL;

CREATE TABLE room_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    image_id uuid NOT NULL REFERENCES images(id) ON DELETE RESTRICT,
    image_order integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_room_images_order CHECK (image_order > 0)
);

CREATE UNIQUE INDEX uq_room_images_active_image
    ON room_images (room_id, image_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_room_images_active_order
    ON room_images (room_id, image_order) WHERE deleted_at IS NULL;

-- Each row is one term of a versioned hotel cancellation policy.
CREATE TABLE booking_cancellation_policy_terms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
    policy_version integer NOT NULL,
    min_elapsed_minutes integer NOT NULL,
    max_elapsed_minutes integer,
    refund_percentage numeric(5,2) NOT NULL,
    description text,
    effective_from timestamptz NOT NULL,
    effective_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT uq_policy_terms_identity UNIQUE (id, hotel_id, policy_version),
    CONSTRAINT chk_policy_terms_version CHECK (policy_version > 0),
    CONSTRAINT chk_policy_terms_min CHECK (min_elapsed_minutes >= 0),
    CONSTRAINT chk_policy_terms_window
        CHECK (max_elapsed_minutes IS NULL OR max_elapsed_minutes > min_elapsed_minutes),
    CONSTRAINT chk_policy_terms_refund CHECK (refund_percentage BETWEEN 0 AND 100),
    CONSTRAINT chk_policy_terms_effective
        CHECK (effective_until IS NULL OR effective_until > effective_from),
    CONSTRAINT ex_policy_terms_no_overlap
        EXCLUDE USING gist (
            hotel_id WITH =,
            policy_version WITH =,
            int4range(min_elapsed_minutes, max_elapsed_minutes, '[)') WITH &&
        ) WHERE (deleted_at IS NULL)
);

CREATE INDEX idx_policy_terms_active_hotel_version
    ON booking_cancellation_policy_terms
        (hotel_id, policy_version, min_elapsed_minutes)
    WHERE deleted_at IS NULL;

CREATE TABLE bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
    tourist_user_id uuid NOT NULL REFERENCES tourists(user_id) ON DELETE RESTRICT,
    booking_code varchar(50) NOT NULL,
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    adult_count integer NOT NULL,
    child_count integer NOT NULL DEFAULT 0,
    guest_name varchar(255) NOT NULL,
    guest_email varchar(254) NOT NULL,
    guest_phone varchar(30) NOT NULL,
    special_requests text,
    booking_status varchar(30) NOT NULL DEFAULT 'PENDING',
    cancelled_at timestamptz,
    reservation_expires_at timestamptz NOT NULL,
    total_amount numeric(14,2) NOT NULL,
    currency char(3) NOT NULL,
    applied_commission_rate numeric(5,2) NOT NULL,
    payment_method varchar(30),
    payment_created_at timestamptz NOT NULL DEFAULT now(),
    payment_expires_at timestamptz NOT NULL,
    payment_status varchar(30) NOT NULL DEFAULT 'PENDING',
    paid_at timestamptz,
    payment_transaction_id text,
    settlement_base_amount numeric(14,2),
    commission_amount numeric(14,2),
    partner_receivable_amount numeric(14,2),
    settlement_status varchar(30) NOT NULL DEFAULT 'NONE',
    settlement_transaction_id text,
    bank_name_snapshot varchar(255),
    bank_account_number_snapshot varchar(255),
    bank_account_holder_snapshot varchar(255),
    settled_at timestamptz,
    cancellation_policy_version integer NOT NULL,
    matched_cancellation_policy_term_id uuid,
    cancellation_min_elapsed_minutes_snapshot integer,
    cancellation_max_elapsed_minutes_snapshot integer,
    refund_percentage_snapshot numeric(5,2),
    cancellation_description_snapshot text,
    refund_amount numeric(14,2),
    refund_reason text,
    refund_status varchar(30) NOT NULL DEFAULT 'NONE',
    refunded_at timestamptz,
    refund_transaction_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT uq_bookings_stay_identity
        UNIQUE (id, hotel_id, check_in_date, check_out_date, currency),
    CONSTRAINT fk_bookings_matched_policy_term
        FOREIGN KEY (
            matched_cancellation_policy_term_id,
            hotel_id,
            cancellation_policy_version
        ) REFERENCES booking_cancellation_policy_terms (id, hotel_id, policy_version)
        ON DELETE RESTRICT,
    CONSTRAINT chk_bookings_code CHECK (btrim(booking_code) <> ''),
    CONSTRAINT chk_bookings_dates CHECK (check_out_date > check_in_date),
    CONSTRAINT chk_bookings_adults CHECK (adult_count > 0),
    CONSTRAINT chk_bookings_children CHECK (child_count >= 0),
    CONSTRAINT chk_bookings_guest_name CHECK (btrim(guest_name) <> ''),
    CONSTRAINT chk_bookings_guest_email CHECK (btrim(guest_email) <> ''),
    CONSTRAINT chk_bookings_guest_phone
        CHECK (guest_phone ~ '^\+?[0-9]{8,15}$'),
    CONSTRAINT chk_bookings_status
        CHECK (booking_status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
    CONSTRAINT chk_bookings_cancelled
        CHECK ((booking_status = 'CANCELLED') = (cancelled_at IS NOT NULL)),
    CONSTRAINT chk_bookings_total CHECK (total_amount >= 0),
    CONSTRAINT chk_bookings_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_bookings_commission_rate
        CHECK (applied_commission_rate BETWEEN 0 AND 100),
    CONSTRAINT chk_bookings_payment_method
        CHECK (
            payment_method IS NULL OR
            payment_method IN ('QR', 'CARD', 'BANK_TRANSFER', 'CASH')
        ),
    CONSTRAINT chk_bookings_payment_status
        CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED')),
    CONSTRAINT chk_bookings_payment_expiry
        CHECK (payment_expires_at > payment_created_at),
    CONSTRAINT chk_bookings_reservation_expiry
        CHECK (reservation_expires_at > payment_created_at),
    CONSTRAINT chk_bookings_paid_time
        CHECK (paid_at IS NULL OR paid_at >= payment_created_at),
    CONSTRAINT chk_bookings_paid_fields
        CHECK (
            payment_status <> 'PAID' OR
            (
                booking_status IN ('CONFIRMED', 'CANCELLED', 'COMPLETED') AND
                payment_method IS NOT NULL AND
                paid_at IS NOT NULL AND
                payment_transaction_id IS NOT NULL AND
                btrim(payment_transaction_id) <> ''
            )
        ),
    CONSTRAINT chk_bookings_confirmed_payment
        CHECK (
            booking_status NOT IN ('CONFIRMED', 'COMPLETED') OR
            payment_status = 'PAID'
        ),
    CONSTRAINT chk_bookings_settlement_status
        CHECK (settlement_status IN ('NONE', 'PENDING', 'PROCESSING', 'SETTLED', 'FAILED')),
    CONSTRAINT chk_bookings_settlement_amounts
        CHECK (
            (settlement_base_amount IS NULL OR settlement_base_amount >= 0) AND
            (commission_amount IS NULL OR commission_amount >= 0) AND
            (partner_receivable_amount IS NULL OR partner_receivable_amount >= 0) AND
            (
                settlement_base_amount IS NULL OR
                commission_amount IS NULL OR
                partner_receivable_amount IS NULL OR
                partner_receivable_amount = settlement_base_amount - commission_amount
            )
        ),
    CONSTRAINT chk_bookings_settlement_formula
        CHECK (
            settlement_base_amount IS NULL OR commission_amount IS NULL OR
            commission_amount = round(
                settlement_base_amount * applied_commission_rate / 100,
                2
            )
        ),
    CONSTRAINT chk_bookings_settled_fields
        CHECK (
            settlement_status <> 'SETTLED' OR
            (
                settlement_base_amount IS NOT NULL AND
                commission_amount IS NOT NULL AND
                partner_receivable_amount IS NOT NULL AND
                settlement_transaction_id IS NOT NULL AND
                btrim(settlement_transaction_id) <> '' AND
                bank_name_snapshot IS NOT NULL AND
                btrim(bank_name_snapshot) <> '' AND
                bank_account_number_snapshot IS NOT NULL AND
                btrim(bank_account_number_snapshot) <> '' AND
                bank_account_holder_snapshot IS NOT NULL AND
                btrim(bank_account_holder_snapshot) <> '' AND
                payment_status = 'PAID' AND
                settled_at IS NOT NULL
            )
        ),
    CONSTRAINT chk_bookings_policy_version CHECK (cancellation_policy_version > 0),
    CONSTRAINT chk_bookings_policy_snapshot
        CHECK (
            (
                matched_cancellation_policy_term_id IS NULL AND
                cancellation_min_elapsed_minutes_snapshot IS NULL AND
                cancellation_max_elapsed_minutes_snapshot IS NULL AND
                refund_percentage_snapshot IS NULL AND
                cancellation_description_snapshot IS NULL
            ) OR (
                matched_cancellation_policy_term_id IS NOT NULL AND
                cancellation_min_elapsed_minutes_snapshot IS NOT NULL AND
                cancellation_min_elapsed_minutes_snapshot >= 0 AND
                (
                    cancellation_max_elapsed_minutes_snapshot IS NULL OR
                    cancellation_max_elapsed_minutes_snapshot >
                        cancellation_min_elapsed_minutes_snapshot
                ) AND
                refund_percentage_snapshot IS NOT NULL AND
                refund_percentage_snapshot BETWEEN 0 AND 100
            )
        ),
    CONSTRAINT chk_bookings_refund_status
        CHECK (refund_status IN ('NONE', 'PENDING', 'REFUNDED', 'NOT_ELIGIBLE', 'FAILED')),
    CONSTRAINT chk_bookings_refund_amount
        CHECK (refund_amount IS NULL OR refund_amount BETWEEN 0 AND total_amount),
    CONSTRAINT chk_bookings_refund_formula
        CHECK (
            refund_amount IS NULL OR refund_percentage_snapshot IS NULL OR
            refund_amount = round(total_amount * refund_percentage_snapshot / 100, 2)
        ),
    CONSTRAINT chk_bookings_refund_reason
        CHECK (refund_reason IS NULL OR btrim(refund_reason) <> ''),
    CONSTRAINT chk_bookings_refunded_fields
        CHECK (
            refund_status <> 'REFUNDED' OR
            (
                booking_status = 'CANCELLED' AND
                payment_status = 'PAID' AND
                matched_cancellation_policy_term_id IS NOT NULL AND
                refund_amount IS NOT NULL AND
                refund_reason IS NOT NULL AND
                refund_transaction_id IS NOT NULL AND
                btrim(refund_transaction_id) <> '' AND
                refunded_at IS NOT NULL
            )
        ),
    CONSTRAINT chk_bookings_not_eligible_fields
        CHECK (
            refund_status <> 'NOT_ELIGIBLE' OR
            (
                booking_status = 'CANCELLED' AND
                matched_cancellation_policy_term_id IS NOT NULL AND
                refund_amount IS NOT NULL AND
                refund_amount = 0 AND
                refund_reason IS NOT NULL
            )
        )
);

CREATE UNIQUE INDEX uq_bookings_code ON bookings (booking_code);
CREATE UNIQUE INDEX uq_bookings_payment_transaction
    ON bookings (payment_transaction_id)
    WHERE payment_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX uq_bookings_settlement_transaction
    ON bookings (settlement_transaction_id)
    WHERE settlement_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX uq_bookings_refund_transaction
    ON bookings (refund_transaction_id)
    WHERE refund_transaction_id IS NOT NULL;
CREATE INDEX idx_bookings_active_tourist
    ON bookings (tourist_user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_active_hotel_stay
    ON bookings (hotel_id, check_in_date, check_out_date, booking_status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_pending_expiry
    ON bookings (reservation_expires_at)
    WHERE deleted_at IS NULL AND booking_status = 'PENDING';

CREATE TABLE booking_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL,
    hotel_id uuid NOT NULL,
    room_id uuid NOT NULL,
    room_number_snapshot varchar(30) NOT NULL,
    room_type_snapshot varchar(60) NOT NULL,
    max_occupancy_snapshot integer NOT NULL,
    price_per_night numeric(14,2) NOT NULL,
    currency char(3) NOT NULL,
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    number_of_nights integer NOT NULL,
    subtotal numeric(14,2) GENERATED ALWAYS AS (
        price_per_night * number_of_nights
    ) STORED,
    reservation_status varchar(20) NOT NULL DEFAULT 'HELD',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT fk_booking_rooms_booking_stay
        FOREIGN KEY (booking_id, hotel_id, check_in_date, check_out_date, currency)
        REFERENCES bookings (id, hotel_id, check_in_date, check_out_date, currency)
        ON DELETE RESTRICT,
    CONSTRAINT fk_booking_rooms_room_hotel
        FOREIGN KEY (room_id, hotel_id)
        REFERENCES rooms (id, hotel_id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_booking_rooms_number CHECK (btrim(room_number_snapshot) <> ''),
    CONSTRAINT chk_booking_rooms_type CHECK (btrim(room_type_snapshot) <> ''),
    CONSTRAINT chk_booking_rooms_occupancy
        CHECK (max_occupancy_snapshot BETWEEN 1 AND 100),
    CONSTRAINT chk_booking_rooms_price CHECK (price_per_night >= 0),
    CONSTRAINT chk_booking_rooms_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_booking_rooms_dates CHECK (check_out_date > check_in_date),
    CONSTRAINT chk_booking_rooms_nights
        CHECK (
            number_of_nights >= 1 AND
            number_of_nights = check_out_date - check_in_date
        ),
    CONSTRAINT chk_booking_rooms_reservation_status
        CHECK (reservation_status IN ('HELD', 'CONFIRMED', 'RELEASED', 'COMPLETED')),
    CONSTRAINT ex_booking_rooms_no_overlap
        EXCLUDE USING gist (
            room_id WITH =,
            daterange(check_in_date, check_out_date, '[)') WITH &&
        ) WHERE (
            deleted_at IS NULL AND
            reservation_status IN ('HELD', 'CONFIRMED')
        )
);

CREATE UNIQUE INDEX uq_booking_rooms_active
    ON booking_rooms (booking_id, room_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_booking_rooms_active_room
    ON booking_rooms (room_id, check_in_date, check_out_date)
    WHERE deleted_at IS NULL;

CREATE TABLE itineraries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tourist_user_id uuid NOT NULL REFERENCES tourists(user_id) ON DELETE RESTRICT,
    name varchar(200) NOT NULL,
    description text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    timezone varchar(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    adult_count integer NOT NULL DEFAULT 1,
    child_count integer NOT NULL DEFAULT 0,
    budget numeric(14,2),
    currency char(3) NOT NULL DEFAULT 'VND',
    status varchar(20) NOT NULL DEFAULT 'DRAFT',
    is_ai_generated boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_itineraries_name CHECK (btrim(name) <> ''),
    CONSTRAINT chk_itineraries_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_itineraries_adults CHECK (adult_count > 0),
    CONSTRAINT chk_itineraries_children CHECK (child_count >= 0),
    CONSTRAINT chk_itineraries_budget CHECK (budget IS NULL OR budget >= 0),
    CONSTRAINT chk_itineraries_currency CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_itineraries_status CHECK (status IN ('DRAFT', 'SAVED', 'ARCHIVED'))
);

CREATE INDEX idx_itineraries_active_tourist_updated
    ON itineraries (tourist_user_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE stopovers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    itinerary_id uuid NOT NULL REFERENCES itineraries(id) ON DELETE RESTRICT,
    place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
    stop_order integer NOT NULL,
    arrival_time timestamptz NOT NULL,
    departure_time timestamptz NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_stopovers_order CHECK (stop_order > 0),
    CONSTRAINT chk_stopovers_times CHECK (departure_time > arrival_time)
);

CREATE UNIQUE INDEX uq_stopovers_active_order
    ON stopovers (itinerary_id, stop_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_stopovers_active_place
    ON stopovers (place_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stopovers_active_schedule
    ON stopovers (itinerary_id, arrival_time, departure_time)
    WHERE deleted_at IS NULL;

CREATE TABLE activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stopover_id uuid NOT NULL REFERENCES stopovers(id) ON DELETE RESTRICT,
    activity_order integer NOT NULL,
    name varchar(200) NOT NULL,
    description text,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    estimated_cost numeric(14,2),
    currency char(3) NOT NULL DEFAULT 'VND',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_activities_order CHECK (activity_order > 0),
    CONSTRAINT chk_activities_name CHECK (btrim(name) <> ''),
    CONSTRAINT chk_activities_times CHECK (end_time > start_time),
    CONSTRAINT chk_activities_cost CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
    CONSTRAINT chk_activities_currency CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE UNIQUE INDEX uq_activities_active_order
    ON activities (stopover_id, activity_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_activities_active_schedule
    ON activities (stopover_id, start_time, end_time) WHERE deleted_at IS NULL;

-- Cross-row booking totals, aggregate guest capacity, expired hold release,
-- booking/room status transitions, and cancellation-term selection are service
-- transaction rules. Database constraints protect their row-level results.

CREATE FUNCTION prevent_hard_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Hard delete is disabled for table %. Set deleted_at instead.', TG_TABLE_NAME;
END;
$$;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users',
        'tourists',
        'hotel_owners',
        'images',
        'user_images',
        'topics',
        'travel_preferences',
        'travel_preference_topics',
        'place_categories',
        'places',
        'place_category_mappings',
        'place_topics',
        'place_images',
        'reference_prices',
        'amenities',
        'hotels',
        'hotel_amenities',
        'rooms',
        'room_amenities',
        'hotel_images',
        'room_images',
        'booking_cancellation_policy_terms',
        'bookings',
        'booking_rooms',
        'itineraries',
        'stopovers',
        'activities'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete()',
            'trg_' || table_name || '_prevent_hard_delete',
            table_name
        );
    END LOOP;
END;
$$;

COMMIT;
