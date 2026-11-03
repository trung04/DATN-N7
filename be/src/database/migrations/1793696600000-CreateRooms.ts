import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRooms1793696600000 implements MigrationInterface {
  name = 'CreateRooms1793696600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "hotel_id" uuid NOT NULL,
        "room_number" varchar(30) NOT NULL,
        "max_occupancy" integer NOT NULL,
        "price_per_night" numeric(12,2) NOT NULL,
        "currency" char(3) NOT NULL DEFAULT 'VND',
        "description" text,
        "operational_status" varchar(30) NOT NULL DEFAULT 'AVAILABLE',
        "room_type" varchar(60) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rooms_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_rooms_hotel_room_number"
          UNIQUE ("hotel_id", "room_number"),
        CONSTRAINT "CHK_rooms_room_number_nonempty"
          CHECK (btrim("room_number") <> ''),
        CONSTRAINT "CHK_rooms_max_occupancy"
          CHECK ("max_occupancy" BETWEEN 1 AND 100),
        CONSTRAINT "CHK_rooms_price_per_night"
          CHECK ("price_per_night" >= 0),
        CONSTRAINT "CHK_rooms_currency"
          CHECK ("currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "CHK_rooms_operational_status"
          CHECK ("operational_status" IN ('AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE')),
        CONSTRAINT "CHK_rooms_room_type_nonempty"
          CHECK (btrim("room_type") <> '')
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_rooms_hotel_id" ON "rooms" ("hotel_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_rooms_operational_status" ON "rooms" ("operational_status")',
    );

    await queryRunner.query(`
      CREATE TABLE "room_amenities" (
        "room_id" uuid NOT NULL,
        "amenity_id" uuid NOT NULL,
        CONSTRAINT "PK_room_amenities" PRIMARY KEY ("room_id", "amenity_id"),
        CONSTRAINT "FK_room_amenities_room"
          FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
          ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT "FK_room_amenities_amenity"
          FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id")
          ON UPDATE CASCADE ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_room_amenities_amenity_id" ON "room_amenities" ("amenity_id")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "room_amenities"');
    await queryRunner.query('DROP TABLE "rooms"');
  }
}
