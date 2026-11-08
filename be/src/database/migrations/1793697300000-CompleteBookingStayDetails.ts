import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompleteBookingStayDetails1793697300000 implements MigrationInterface {
  name = 'CompleteBookingStayDetails1793697300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "bookings" RENAME COLUMN "qr_created_at" TO "payment_created_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "bookings" RENAME COLUMN "qr_expires_at" TO "payment_expires_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "bookings" RENAME CONSTRAINT "CHK_bookings_qr_timestamps" TO "CHK_bookings_payment_timestamps"',
    );
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN "check_in_date" date,
        ADD COLUMN "check_out_date" date,
        ADD COLUMN "guest_email" varchar(255),
        ADD COLUMN "guest_phone" varchar(30),
        ADD COLUMN "cancelled_at" timestamptz,
        ADD COLUMN "cancellation_window_snapshot" integer,
        ADD COLUMN "cancellation_fee_rate_snapshot" numeric(5,2),
        ADD COLUMN "cancellation_description_snapshot" text
    `);
    await queryRunner.query(`
      UPDATE "bookings"
      SET
        "updated_at" = "created_at",
        "check_in_date" = ("created_at" AT TIME ZONE 'UTC')::date,
        "check_out_date" = ("created_at" AT TIME ZONE 'UTC')::date + 1,
        "guest_email" = 'legacy-' || replace("id"::text, '-', '') || '@example.invalid',
        "guest_phone" = 'N/A',
        "cancelled_at" = CASE
          WHEN "booking_status" = 'CANCELLED' THEN "created_at"
          ELSE NULL
        END
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ALTER COLUMN "check_in_date" SET NOT NULL,
        ALTER COLUMN "check_out_date" SET NOT NULL,
        ALTER COLUMN "guest_email" SET NOT NULL,
        ALTER COLUMN "guest_phone" SET NOT NULL,
        ADD CONSTRAINT "CHK_bookings_stay_dates"
          CHECK ("check_out_date" > "check_in_date"),
        ADD CONSTRAINT "CHK_bookings_guest_email_nonempty"
          CHECK (btrim("guest_email") <> ''),
        ADD CONSTRAINT "CHK_bookings_guest_phone_nonempty"
          CHECK (btrim("guest_phone") <> ''),
        ADD CONSTRAINT "CHK_bookings_cancellation_window_snapshot"
          CHECK ("cancellation_window_snapshot" IS NULL OR "cancellation_window_snapshot" >= 0),
        ADD CONSTRAINT "CHK_bookings_cancellation_fee_rate_snapshot"
          CHECK (
            "cancellation_fee_rate_snapshot" IS NULL
            OR "cancellation_fee_rate_snapshot" BETWEEN 0 AND 100
          )
    `);
    await queryRunner.query(`
      CREATE TABLE "booking_rooms" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "room_id" uuid NOT NULL,
        "room_number_snapshot" varchar(30) NOT NULL,
        "room_type_snapshot" varchar(60) NOT NULL,
        "max_occupancy_snapshot" integer NOT NULL,
        "price_per_night" numeric(12,2) NOT NULL,
        "currency" char(3) NOT NULL,
        "number_of_nights" integer NOT NULL,
        "subtotal" numeric(12,2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_rooms_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_booking_rooms_booking_room" UNIQUE ("booking_id", "room_id"),
        CONSTRAINT "CHK_booking_rooms_room_number_nonempty"
          CHECK (btrim("room_number_snapshot") <> ''),
        CONSTRAINT "CHK_booking_rooms_room_type_nonempty"
          CHECK (btrim("room_type_snapshot") <> ''),
        CONSTRAINT "CHK_booking_rooms_max_occupancy"
          CHECK ("max_occupancy_snapshot" BETWEEN 1 AND 100),
        CONSTRAINT "CHK_booking_rooms_price_per_night"
          CHECK ("price_per_night" >= 0),
        CONSTRAINT "CHK_booking_rooms_currency"
          CHECK ("currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "CHK_booking_rooms_number_of_nights"
          CHECK ("number_of_nights" >= 1),
        CONSTRAINT "CHK_booking_rooms_subtotal"
          CHECK (
            "subtotal" >= 0
            AND "subtotal" = "price_per_night" * "number_of_nights"
          ),
        CONSTRAINT "FK_booking_rooms_booking_id_bookings_id"
          FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
          ON UPDATE NO ACTION ON DELETE CASCADE,
        CONSTRAINT "FK_booking_rooms_room_id_rooms_id"
          FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
          ON UPDATE NO ACTION ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_booking_rooms_room_id" ON "booking_rooms" ("room_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_bookings_stay_dates" ON "bookings" ("check_in_date", "check_out_date")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_bookings_stay_dates"');
    await queryRunner.query('DROP TABLE "booking_rooms"');
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_cancellation_fee_rate_snapshot",
        DROP CONSTRAINT "CHK_bookings_cancellation_window_snapshot",
        DROP CONSTRAINT "CHK_bookings_guest_phone_nonempty",
        DROP CONSTRAINT "CHK_bookings_guest_email_nonempty",
        DROP CONSTRAINT "CHK_bookings_stay_dates",
        DROP COLUMN "cancellation_description_snapshot",
        DROP COLUMN "cancellation_fee_rate_snapshot",
        DROP COLUMN "cancellation_window_snapshot",
        DROP COLUMN "cancelled_at",
        DROP COLUMN "guest_phone",
        DROP COLUMN "guest_email",
        DROP COLUMN "check_out_date",
        DROP COLUMN "check_in_date",
        DROP COLUMN "updated_at"
    `);
    await queryRunner.query(
      'ALTER TABLE "bookings" RENAME CONSTRAINT "CHK_bookings_payment_timestamps" TO "CHK_bookings_qr_timestamps"',
    );
    await queryRunner.query(
      'ALTER TABLE "bookings" RENAME COLUMN "payment_expires_at" TO "qr_expires_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "bookings" RENAME COLUMN "payment_created_at" TO "qr_created_at"',
    );
  }
}
