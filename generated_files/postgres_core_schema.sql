-- PostgreSQL 13+ schema for tourist use cases represented by prompts 01-10:
-- registration, login, password reset, profile, account deactivation, and
-- travel preferences. All other domains are intentionally deferred.

BEGIN;

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar(50) NOT NULL,
    email varchar(254) NOT NULL,
    password_hash varchar(255),
    google_account_id varchar(255),
    first_name varchar(100),
    last_name varchar(100),
    display_name varchar(150),
    phone_number varchar(20),
    date_of_birth date,
    gender varchar(20),
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
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
    ON users (google_account_id)
    WHERE google_account_id IS NOT NULL;

CREATE TABLE tourists (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
    bio text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE TABLE images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url text NOT NULL,
    alt_text varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_images_url_nonempty CHECK (btrim(image_url) <> '')
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
    name varchar(120) NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_place_categories_name_nonempty CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX uq_place_categories_name_active
    ON place_categories (lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE places (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(200) NOT NULL,
    description text,
    address varchar(500),
    country_code char(2),
    province_code varchar(20),
    timezone varchar(100),
    latitude numeric(10,7),
    longitude numeric(10,7),
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    average_rating numeric(3,2) NOT NULL DEFAULT 0,
    external_provider_id varchar(255),
    opening_times jsonb,
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
    CONSTRAINT chk_places_name_nonempty CHECK (btrim(name) <> ''),
    CONSTRAINT chk_places_country_code
        CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
    CONSTRAINT chk_places_province_code
        CHECK (province_code IS NULL OR province_code ~ '^[A-Z0-9-]{1,20}$'),
    CONSTRAINT chk_places_coordinate_pair
        CHECK ((latitude IS NULL) = (longitude IS NULL)),
    CONSTRAINT chk_places_latitude CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_places_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_places_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT chk_places_average_rating CHECK (average_rating BETWEEN 0 AND 5),
    CONSTRAINT chk_places_opening_times
        CHECK (opening_times IS NULL OR jsonb_typeof(opening_times) IN ('object', 'array'))
);

CREATE INDEX idx_places_active_location
    ON places (country_code, province_code) WHERE deleted_at IS NULL AND status = 'ACTIVE';
CREATE INDEX idx_places_active_search
    ON places USING gin (search_document) WHERE deleted_at IS NULL AND status = 'ACTIVE';
CREATE UNIQUE INDEX uq_places_external_provider_active
    ON places (external_provider_id)
    WHERE external_provider_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE place_category_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
    place_category_id uuid NOT NULL REFERENCES place_categories(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE UNIQUE INDEX uq_place_category_mappings_active
    ON place_category_mappings (place_id, place_category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_place_category_mappings_active_category
    ON place_category_mappings (place_category_id, place_id) WHERE deleted_at IS NULL;

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
    CONSTRAINT chk_amenities_code_format
        CHECK (code ~ '^[A-Z0-9]+(_[A-Z0-9]+)*$'),
    CONSTRAINT chk_amenities_name_nonempty CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX uq_amenities_code_active
    ON amenities (code) WHERE deleted_at IS NULL;

CREATE TABLE hotels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id uuid NOT NULL REFERENCES places(id) ON DELETE RESTRICT,
    star_rating smallint,
    contact_email varchar(254),
    contact_phone varchar(20),
    operational_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
    approval_status varchar(30) NOT NULL DEFAULT 'PENDING',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chk_hotels_star_rating CHECK (star_rating IS NULL OR star_rating BETWEEN 1 AND 5),
    CONSTRAINT chk_hotels_contact_phone
        CHECK (contact_phone IS NULL OR contact_phone ~ '^\+?[0-9]{8,15}$'),
    CONSTRAINT chk_hotels_operational_status
        CHECK (operational_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    CONSTRAINT chk_hotels_approval_status
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_INFO'))
);

CREATE UNIQUE INDEX uq_hotels_place_active
    ON hotels (place_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hotels_active_catalog
    ON hotels (approval_status, operational_status, star_rating) WHERE deleted_at IS NULL;

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
    CONSTRAINT chk_rooms_room_number CHECK (btrim(room_number) <> ''),
    CONSTRAINT chk_rooms_max_occupancy CHECK (max_occupancy BETWEEN 1 AND 100),
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
    ON stopovers (itinerary_id, arrival_time, departure_time) WHERE deleted_at IS NULL;

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

-- Hard deletion is blocked at the database boundary. Services soft-delete by
-- updating deleted_at (and users.status = 'DEACTIVATED' for account removal).
CREATE FUNCTION prevent_hard_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Hard delete is disabled for table %. Set deleted_at instead.', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_users_prevent_hard_delete
    BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_tourists_prevent_hard_delete
    BEFORE DELETE ON tourists FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_images_prevent_hard_delete
    BEFORE DELETE ON images FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_user_images_prevent_hard_delete
    BEFORE DELETE ON user_images FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_topics_prevent_hard_delete
    BEFORE DELETE ON topics FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_travel_preferences_prevent_hard_delete
    BEFORE DELETE ON travel_preferences FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_travel_preference_topics_prevent_hard_delete
    BEFORE DELETE ON travel_preference_topics FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_place_categories_prevent_hard_delete
    BEFORE DELETE ON place_categories FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_places_prevent_hard_delete
    BEFORE DELETE ON places FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_place_category_mappings_prevent_hard_delete
    BEFORE DELETE ON place_category_mappings FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_place_topics_prevent_hard_delete
    BEFORE DELETE ON place_topics FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_reference_prices_prevent_hard_delete
    BEFORE DELETE ON reference_prices FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_amenities_prevent_hard_delete
    BEFORE DELETE ON amenities FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_hotels_prevent_hard_delete
    BEFORE DELETE ON hotels FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_hotel_amenities_prevent_hard_delete
    BEFORE DELETE ON hotel_amenities FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_rooms_prevent_hard_delete
    BEFORE DELETE ON rooms FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_room_amenities_prevent_hard_delete
    BEFORE DELETE ON room_amenities FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_hotel_images_prevent_hard_delete
    BEFORE DELETE ON hotel_images FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_room_images_prevent_hard_delete
    BEFORE DELETE ON room_images FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_itineraries_prevent_hard_delete
    BEFORE DELETE ON itineraries FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_stopovers_prevent_hard_delete
    BEFORE DELETE ON stopovers FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
CREATE TRIGGER trg_activities_prevent_hard_delete
    BEFORE DELETE ON activities FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

COMMIT;
