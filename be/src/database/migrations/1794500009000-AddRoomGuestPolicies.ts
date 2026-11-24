import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomGuestPolicies1794500009000 implements MigrationInterface {
  name = 'AddRoomGuestPolicies1794500009000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "room_guest_policies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "hotel_id" uuid NOT NULL,
        "room_type" varchar(60) NOT NULL,
        "max_adults" integer NOT NULL,
        "max_children" integer NOT NULL DEFAULT 0,
        "adult_age_from" integer NOT NULL DEFAULT 12,
        "free_child_max_age" integer NOT NULL DEFAULT 11,
        "child_surcharge_per_night" numeric(12,2) NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_guest_policies_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_room_guest_policies_hotel_id_hotels_id"
          FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_room_guest_policies_adult_bounds"
          CHECK ("max_adults" > 0 AND "adult_age_from" BETWEEN 2 AND 18),
        CONSTRAINT "CHK_room_guest_policies_child_bounds"
          CHECK ("max_children" >= 0 AND "free_child_max_age" >= 0 AND "free_child_max_age" < "adult_age_from"),
        CONSTRAINT "CHK_room_guest_policies_child_surcharge"
          CHECK ("child_surcharge_per_night" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_room_guest_policies_hotel_room_type"
      ON "room_guest_policies" ("hotel_id", lower(btrim("room_type")))
    `);
    await queryRunner.query(`
      INSERT INTO "room_guest_policies" (
        "hotel_id", "room_type", "max_adults", "max_children",
        "adult_age_from", "free_child_max_age", "child_surcharge_per_night"
      )
      SELECT "hotel_id", min(btrim("room_type")), min("max_occupancy"),
        min("max_occupancy"), 12, 11, 0
      FROM "rooms"
      WHERE "deleted_at" IS NULL
      GROUP BY "hotel_id", lower(btrim("room_type"))
    `);

    await queryRunner.query(`
      ALTER TABLE "booking_rooms"
        ADD COLUMN "adult_count" integer,
        ADD COLUMN "max_adults_snapshot" integer,
        ADD COLUMN "max_children_snapshot" integer,
        ADD COLUMN "adult_age_from_snapshot" integer,
        ADD COLUMN "free_child_max_age_snapshot" integer,
        ADD COLUMN "child_surcharge_per_night_snapshot" numeric(12,2)
    `);
    await queryRunner.query(`
      CREATE TABLE "booking_room_children" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_room_id" uuid NOT NULL,
        "age_at_check_in" smallint NOT NULL,
        "surcharge_per_night_snapshot" numeric(12,2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_room_children_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_booking_room_children_booking_room_id_booking_rooms_id"
          FOREIGN KEY ("booking_room_id") REFERENCES "booking_rooms"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_booking_room_children_age" CHECK ("age_at_check_in" BETWEEN 0 AND 17),
        CONSTRAINT "CHK_booking_room_children_surcharge" CHECK ("surcharge_per_night_snapshot" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_booking_room_children_booking_room_id"
      ON "booking_room_children" ("booking_room_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "booking_room_children"');
    await queryRunner.query(`
      ALTER TABLE "booking_rooms"
        DROP COLUMN "adult_count",
        DROP COLUMN "max_adults_snapshot",
        DROP COLUMN "max_children_snapshot",
        DROP COLUMN "adult_age_from_snapshot",
        DROP COLUMN "free_child_max_age_snapshot",
        DROP COLUMN "child_surcharge_per_night_snapshot"
    `);
    await queryRunner.query('DROP TABLE "room_guest_policies"');
  }
}
