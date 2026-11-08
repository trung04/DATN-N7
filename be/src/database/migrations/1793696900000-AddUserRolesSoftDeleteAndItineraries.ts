import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRolesSoftDeleteAndItineraries1793696900000 implements MigrationInterface {
  name = 'AddUserRolesSoftDeleteAndItineraries1793696900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD "role" varchar(20) NOT NULL DEFAULT 'TOURIST',
        ADD "deleted_at" timestamptz;
      ALTER TABLE "users" DROP CONSTRAINT "CHK_users_status";
      ALTER TABLE "users" ADD CONSTRAINT "CHK_users_status"
        CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DEACTIVATED'));
      ALTER TABLE "users" ADD CONSTRAINT "CHK_users_role"
        CHECK ("role" IN ('TOURIST', 'HOTEL_OWNER', 'ADMIN'));
      ALTER TABLE "users" ADD CONSTRAINT "CHK_users_soft_delete_status"
        CHECK ("deleted_at" IS NULL OR "status" = 'DEACTIVATED');
      DROP INDEX "UQ_users_username_lower";
      DROP INDEX "UQ_users_email_lower";
      DROP INDEX "UQ_users_google_account_id";
      CREATE UNIQUE INDEX "UQ_users_username_lower"
        ON "users" (LOWER("username")) WHERE "deleted_at" IS NULL;
      CREATE UNIQUE INDEX "UQ_users_email_lower"
        ON "users" (LOWER("email")) WHERE "deleted_at" IS NULL;
      CREATE UNIQUE INDEX "UQ_users_google_account_id"
        ON "users" ("google_account_id")
        WHERE "google_account_id" IS NOT NULL AND "deleted_at" IS NULL;

      ALTER TABLE "amenities" ADD "deleted_at" timestamptz;
      ALTER TABLE "amenities" DROP CONSTRAINT "UQ_amenities_code";
      CREATE UNIQUE INDEX "UQ_amenities_code" ON "amenities" ("code")
        WHERE "deleted_at" IS NULL;

      ALTER TABLE "rooms" ADD "deleted_at" timestamptz;
      ALTER TABLE "rooms" DROP CONSTRAINT "UQ_rooms_hotel_room_number";
      CREATE UNIQUE INDEX "UQ_rooms_hotel_room_number"
        ON "rooms" ("hotel_id", "room_number")
        WHERE "deleted_at" IS NULL;

      ALTER TABLE "room_amenities"
        DROP CONSTRAINT "PK_room_amenities",
        ADD "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        ADD "created_at" timestamptz NOT NULL DEFAULT now(),
        ADD "updated_at" timestamptz NOT NULL DEFAULT now(),
        ADD "deleted_at" timestamptz,
        ADD CONSTRAINT "PK_room_amenities" PRIMARY KEY ("id");
      ALTER TABLE "room_amenities"
        DROP CONSTRAINT "FK_room_amenities_room",
        DROP CONSTRAINT "FK_room_amenities_amenity";
      ALTER TABLE "room_amenities"
        ADD CONSTRAINT "FK_room_amenities_room"
          FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "FK_room_amenities_amenity"
          FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE RESTRICT;
      DROP INDEX "IDX_room_amenities_amenity_id";
      CREATE UNIQUE INDEX "UQ_room_amenities_active_pair"
        ON "room_amenities" ("room_id", "amenity_id")
        WHERE "deleted_at" IS NULL;
      CREATE INDEX "IDX_room_amenities_amenity_id"
        ON "room_amenities" ("amenity_id") WHERE "deleted_at" IS NULL;

      ALTER TABLE "hotel_owners" ADD "deleted_at" timestamptz;
      ALTER TABLE "hotel_owners"
        DROP CONSTRAINT "FK_hotel_owners_user_id_users_id";
      ALTER TABLE "hotel_owners" ADD CONSTRAINT "FK_hotel_owners_user_id_users_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
    `);

    await queryRunner.query(`
      CREATE TABLE "itineraries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tourist_user_id" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "description" text,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "timezone" varchar(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
        "adult_count" integer NOT NULL DEFAULT 1,
        "child_count" integer NOT NULL DEFAULT 0,
        "budget" numeric(14,2),
        "currency" char(3) NOT NULL DEFAULT 'VND',
        "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
        "is_ai_generated" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_itineraries_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itineraries_tourist_user_id"
          FOREIGN KEY ("tourist_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_itineraries_name" CHECK (btrim("name") <> ''),
        CONSTRAINT "CHK_itineraries_dates" CHECK ("end_date" >= "start_date"),
        CONSTRAINT "CHK_itineraries_adults" CHECK ("adult_count" > 0),
        CONSTRAINT "CHK_itineraries_children" CHECK ("child_count" >= 0),
        CONSTRAINT "CHK_itineraries_budget" CHECK ("budget" IS NULL OR "budget" >= 0),
        CONSTRAINT "CHK_itineraries_currency" CHECK ("currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "CHK_itineraries_status"
          CHECK ("status" IN ('DRAFT', 'SAVED', 'ARCHIVED'))
      );
      CREATE INDEX "IDX_itineraries_active_tourist_updated"
        ON "itineraries" ("tourist_user_id", "updated_at" DESC)
        WHERE "deleted_at" IS NULL;

      CREATE TABLE "stopovers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "itinerary_id" uuid NOT NULL,
        "place_id" uuid NOT NULL,
        "stop_order" integer NOT NULL,
        "arrival_time" timestamptz NOT NULL,
        "departure_time" timestamptz NOT NULL,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_stopovers_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stopovers_itinerary_id"
          FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_stopovers_order" CHECK ("stop_order" > 0),
        CONSTRAINT "CHK_stopovers_times" CHECK ("departure_time" > "arrival_time")
      );
      CREATE UNIQUE INDEX "UQ_stopovers_active_order"
        ON "stopovers" ("itinerary_id", "stop_order")
        WHERE "deleted_at" IS NULL;
      CREATE INDEX "IDX_stopovers_active_place" ON "stopovers" ("place_id")
        WHERE "deleted_at" IS NULL;
      CREATE INDEX "IDX_stopovers_active_schedule"
        ON "stopovers" ("itinerary_id", "arrival_time", "departure_time")
        WHERE "deleted_at" IS NULL;

      CREATE TABLE "activities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "stopover_id" uuid NOT NULL,
        "activity_order" integer NOT NULL,
        "name" varchar(200) NOT NULL,
        "description" text,
        "start_time" timestamptz NOT NULL,
        "end_time" timestamptz NOT NULL,
        "estimated_cost" numeric(14,2),
        "currency" char(3) NOT NULL DEFAULT 'VND',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_activities_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_activities_stopover_id"
          FOREIGN KEY ("stopover_id") REFERENCES "stopovers"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_activities_order" CHECK ("activity_order" > 0),
        CONSTRAINT "CHK_activities_name" CHECK (btrim("name") <> ''),
        CONSTRAINT "CHK_activities_times" CHECK ("end_time" > "start_time"),
        CONSTRAINT "CHK_activities_cost"
          CHECK ("estimated_cost" IS NULL OR "estimated_cost" >= 0),
        CONSTRAINT "CHK_activities_currency" CHECK ("currency" ~ '^[A-Z]{3}$')
      );
      CREATE UNIQUE INDEX "UQ_activities_active_order"
        ON "activities" ("stopover_id", "activity_order")
        WHERE "deleted_at" IS NULL;
      CREATE INDEX "IDX_activities_active_schedule"
        ON "activities" ("stopover_id", "start_time", "end_time")
        WHERE "deleted_at" IS NULL;
    `);

    await queryRunner.query(`
      CREATE FUNCTION prevent_hard_delete() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Hard delete is disabled for table %. Set deleted_at instead.', TG_TABLE_NAME;
      END;
      $$;
    `);
    for (const table of [
      'users',
      'amenities',
      'rooms',
      'room_amenities',
      'hotel_owners',
      'itineraries',
      'stopovers',
      'activities',
    ]) {
      await queryRunner.query(
        `CREATE TRIGGER "TRG_${table}_prevent_hard_delete" BEFORE DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete()`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'users',
      'amenities',
      'rooms',
      'room_amenities',
      'hotel_owners',
      'itineraries',
      'stopovers',
      'activities',
    ]) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS "TRG_${table}_prevent_hard_delete" ON "${table}"`,
      );
    }
    await queryRunner.query('DROP FUNCTION prevent_hard_delete()');
    await queryRunner.query('DROP TABLE "activities"');
    await queryRunner.query('DROP TABLE "stopovers"');
    await queryRunner.query('DROP TABLE "itineraries"');

    await queryRunner.query(`
      DELETE FROM "hotel_owners" WHERE "deleted_at" IS NOT NULL;
      ALTER TABLE "hotel_owners"
        DROP CONSTRAINT "FK_hotel_owners_user_id_users_id";
      ALTER TABLE "hotel_owners" ADD CONSTRAINT "FK_hotel_owners_user_id_users_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
      ALTER TABLE "hotel_owners" DROP COLUMN "deleted_at";

      DELETE FROM "room_amenities" WHERE "deleted_at" IS NOT NULL;
      ALTER TABLE "room_amenities"
        DROP CONSTRAINT "FK_room_amenities_room",
        DROP CONSTRAINT "FK_room_amenities_amenity";
      ALTER TABLE "room_amenities"
        ADD CONSTRAINT "FK_room_amenities_room"
          FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        ADD CONSTRAINT "FK_room_amenities_amenity"
          FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      DROP INDEX "IDX_room_amenities_amenity_id";
      DROP INDEX "UQ_room_amenities_active_pair";
      ALTER TABLE "room_amenities" DROP CONSTRAINT "PK_room_amenities";
      ALTER TABLE "room_amenities"
        DROP COLUMN "id",
        DROP COLUMN "created_at",
        DROP COLUMN "updated_at",
        DROP COLUMN "deleted_at";
      ALTER TABLE "room_amenities" ADD CONSTRAINT "PK_room_amenities"
        PRIMARY KEY ("room_id", "amenity_id");
      CREATE INDEX "IDX_room_amenities_amenity_id"
        ON "room_amenities" ("amenity_id");

      DELETE FROM "rooms" WHERE "deleted_at" IS NOT NULL;
      DROP INDEX "UQ_rooms_hotel_room_number";
      ALTER TABLE "rooms" DROP COLUMN "deleted_at";
      ALTER TABLE "rooms" ADD CONSTRAINT "UQ_rooms_hotel_room_number"
        UNIQUE ("hotel_id", "room_number");

      DELETE FROM "amenities" WHERE "deleted_at" IS NOT NULL;
      DROP INDEX "UQ_amenities_code";
      ALTER TABLE "amenities" DROP COLUMN "deleted_at";
      ALTER TABLE "amenities" ADD CONSTRAINT "UQ_amenities_code" UNIQUE ("code");

      DELETE FROM "users" WHERE "deleted_at" IS NOT NULL;
      DROP INDEX "UQ_users_username_lower";
      DROP INDEX "UQ_users_email_lower";
      DROP INDEX "UQ_users_google_account_id";
      ALTER TABLE "users" DROP CONSTRAINT "CHK_users_soft_delete_status";
      ALTER TABLE "users" DROP CONSTRAINT "CHK_users_role";
      ALTER TABLE "users" DROP CONSTRAINT "CHK_users_status";
      ALTER TABLE "users" DROP COLUMN "deleted_at", DROP COLUMN "role";
      ALTER TABLE "users" ADD CONSTRAINT "CHK_users_status"
        CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'));
      CREATE UNIQUE INDEX "UQ_users_username_lower" ON "users" (LOWER("username"));
      CREATE UNIQUE INDEX "UQ_users_email_lower" ON "users" (LOWER("email"));
      CREATE UNIQUE INDEX "UQ_users_google_account_id"
        ON "users" ("google_account_id") WHERE "google_account_id" IS NOT NULL;
    `);
  }
}
