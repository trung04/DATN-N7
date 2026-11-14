import { MigrationInterface, QueryRunner } from 'typeorm';

const LEGACY_HOTEL_IMAGES = 'hotel_images_legacy_1794500002000';
const IMAGE_MAPPINGS = ['hotel_images', 'room_images', 'place_images', 'user_images'];

export class NormalizeImages1794500002000 implements MigrationInterface {
  name = 'NormalizeImages1794500002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Preserve the legacy hotel upload records instead of dropping the table.
    // The original schema stores object metadata directly on hotel_images.
    if (await queryRunner.hasTable('hotel_images')) {
      if (!(await queryRunner.hasColumn('hotel_images', 'object_key'))) {
        throw new Error(
          'NormalizeImages found an unexpected hotel_images schema; stopping without changing image data',
        );
      }
      if (await queryRunner.hasTable(LEGACY_HOTEL_IMAGES)) {
        throw new Error(
          `NormalizeImages archive table ${LEGACY_HOTEL_IMAGES} already exists`,
        );
      }
      await queryRunner.query(
        `ALTER TABLE "hotel_images" RENAME TO "${LEGACY_HOTEL_IMAGES}"`,
      );
      await queryRunner.query(`
        ALTER TABLE "${LEGACY_HOTEL_IMAGES}"
          RENAME CONSTRAINT "PK_hotel_images"
          TO "PK_hotel_images_legacy_1794500002000";
        ALTER INDEX IF EXISTS "IDX_hotel_images_hotel_created"
          RENAME TO "IDX_hotel_images_hotel_created_legacy_1794500002000";
      `);
    }

    await queryRunner.query(`
      CREATE TABLE "images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "storage_provider" varchar(30) NOT NULL DEFAULT 'EXTERNAL',
        "object_key" varchar(500),
        "image_url" text,
        "content_type" varchar(100),
        "byte_size" integer,
        "width" integer,
        "height" integer,
        "alt_text" varchar(255),
        "source_provider" varchar(50),
        "source_url" text,
        "attribution_text" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_images" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_images_storage_provider"
          CHECK ("storage_provider" IN ('MINIO', 'EXTERNAL')),
        CONSTRAINT "CHK_images_storage_location" CHECK (
          ("storage_provider" = 'MINIO' AND "object_key" IS NOT NULL AND "image_url" IS NULL)
          OR ("storage_provider" = 'EXTERNAL' AND "image_url" IS NOT NULL AND "object_key" IS NULL)
        ),
        CONSTRAINT "CHK_images_managed_metadata" CHECK (
          "storage_provider" <> 'MINIO'
          OR ("content_type" IS NOT NULL AND "byte_size" > 0 AND "width" > 0 AND "height" > 0)
        ),
        CONSTRAINT "CHK_images_optional_metadata" CHECK (
          ("byte_size" IS NULL OR "byte_size" > 0)
          AND ("width" IS NULL OR "width" > 0)
          AND ("height" IS NULL OR "height" > 0)
        )
      );
      CREATE UNIQUE INDEX "UQ_images_url_active"
        ON "images" ("image_url")
        WHERE "deleted_at" IS NULL AND "image_url" IS NOT NULL;
      CREATE UNIQUE INDEX "UQ_images_object_key_active"
        ON "images" ("object_key")
        WHERE "deleted_at" IS NULL AND "object_key" IS NOT NULL;

      CREATE TABLE "hotel_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "hotel_id" uuid NOT NULL,
        "image_id" uuid NOT NULL,
        "image_order" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_hotel_images" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_hotel_images_order" CHECK ("image_order" > 0),
        CONSTRAINT "FK_hotel_images_hotel"
          FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_hotel_images_image"
          FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "UQ_hotel_images_active_image"
        ON "hotel_images" ("hotel_id", "image_id") WHERE "deleted_at" IS NULL;
      CREATE UNIQUE INDEX "UQ_hotel_images_active_order"
        ON "hotel_images" ("hotel_id", "image_order") WHERE "deleted_at" IS NULL;
      CREATE INDEX "IDX_hotel_images_active_image"
        ON "hotel_images" ("image_id") WHERE "deleted_at" IS NULL;

      CREATE TABLE "room_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "room_id" uuid NOT NULL,
        "image_id" uuid NOT NULL,
        "image_order" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_room_images" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_room_images_order" CHECK ("image_order" > 0),
        CONSTRAINT "FK_room_images_room"
          FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_room_images_image"
          FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "UQ_room_images_active_image"
        ON "room_images" ("room_id", "image_id") WHERE "deleted_at" IS NULL;
      CREATE UNIQUE INDEX "UQ_room_images_active_order"
        ON "room_images" ("room_id", "image_order") WHERE "deleted_at" IS NULL;
      CREATE INDEX "IDX_room_images_active_image"
        ON "room_images" ("image_id") WHERE "deleted_at" IS NULL;

      CREATE TABLE "place_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "place_id" uuid NOT NULL,
        "image_id" uuid NOT NULL,
        "image_order" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_place_images" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_place_images_order" CHECK ("image_order" > 0),
        CONSTRAINT "FK_place_images_place"
          FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_place_images_image"
          FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "UQ_place_images_active_image"
        ON "place_images" ("place_id", "image_id") WHERE "deleted_at" IS NULL;
      CREATE UNIQUE INDEX "UQ_place_images_active_order"
        ON "place_images" ("place_id", "image_order") WHERE "deleted_at" IS NULL;
      CREATE INDEX "IDX_place_images_active_image"
        ON "place_images" ("image_id") WHERE "deleted_at" IS NULL;

      CREATE TABLE "user_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "image_id" uuid NOT NULL,
        "image_type" varchar(30) NOT NULL DEFAULT 'AVATAR',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_user_images" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_user_images_type" CHECK ("image_type" IN ('AVATAR', 'PROFILE')),
        CONSTRAINT "FK_user_images_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_user_images_image"
          FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "UQ_user_images_active_type"
        ON "user_images" ("user_id", "image_type") WHERE "deleted_at" IS NULL;
      CREATE INDEX "IDX_user_images_active_image"
        ON "user_images" ("image_id") WHERE "deleted_at" IS NULL;
    `);

    if (await queryRunner.hasTable(LEGACY_HOTEL_IMAGES)) {
      await queryRunner.query(`
        INSERT INTO "images" (
          "id", "storage_provider", "object_key", "content_type", "byte_size",
          "width", "height", "created_at", "updated_at"
        )
        SELECT "id", 'MINIO', "object_key", "content_type", "byte_size",
               "width", "height", "created_at", "created_at"
        FROM "${LEGACY_HOTEL_IMAGES}"
        ON CONFLICT ("id") DO NOTHING;

        INSERT INTO "hotel_images" (
          "hotel_id", "image_id", "image_order", "created_at", "updated_at"
        )
        SELECT "hotel_id", "id",
               row_number() OVER (PARTITION BY "hotel_id" ORDER BY "created_at", "id")::integer,
               "created_at", "created_at"
        FROM "${LEGACY_HOTEL_IMAGES}"
        ON CONFLICT DO NOTHING;
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(`
      SELECT (
        (SELECT count(*) FROM "images") +
        (SELECT count(*) FROM "hotel_images") +
        (SELECT count(*) FROM "room_images") +
        (SELECT count(*) FROM "place_images") +
        (SELECT count(*) FROM "user_images")
      )::integer AS "count"
    `)) as Array<{ count: number }>;
    if (Number(count) > 0) {
      throw new Error('Cannot revert NormalizeImages while image records exist');
    }

    await queryRunner.query(`
      DROP TABLE "user_images";
      DROP TABLE "place_images";
      DROP TABLE "room_images";
      DROP TABLE "hotel_images";
      DROP TABLE "images";
    `);
    if (await queryRunner.hasTable(LEGACY_HOTEL_IMAGES)) {
      await queryRunner.query(
        `ALTER TABLE "${LEGACY_HOTEL_IMAGES}" RENAME TO "hotel_images"`,
      );
    }
  }
}
