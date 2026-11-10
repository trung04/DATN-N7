import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlaces1793696900000 implements MigrationInterface {
  name = 'CreatePlaces1793696900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "places" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(200) NOT NULL,
        "description" text,
        "address" varchar(500),
        "country_code" char(2),
        "province_code" varchar(20),
        "timezone" varchar(100),
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "search_document" text GENERATED ALWAYS AS (
          lower(
            "name" || ' ' ||
            coalesce("description", '') || ' ' ||
            coalesce("address", '') || ' ' ||
            coalesce("country_code", '') || ' ' ||
            coalesce("province_code", '')
          )
        ) STORED,
        "average_rating" numeric(3,2) NOT NULL DEFAULT 0,
        "external_provider_id" varchar(255),
        "opening_time" varchar(255),
        CONSTRAINT "PK_places_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_places_name_nonempty" CHECK (btrim("name") <> ''),
        CONSTRAINT "CHK_places_country_code"
          CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$'),
        CONSTRAINT "CHK_places_province_code"
          CHECK ("province_code" IS NULL OR "province_code" ~ '^[A-Z0-9-]{1,20}$'),
        CONSTRAINT "CHK_places_coordinate_pair"
          CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
        CONSTRAINT "CHK_places_latitude"
          CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
        CONSTRAINT "CHK_places_longitude"
          CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
        CONSTRAINT "CHK_places_status"
          CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT "CHK_places_average_rating"
          CHECK ("average_rating" BETWEEN 0 AND 5),
        CONSTRAINT "CHK_places_external_provider_nonempty"
          CHECK ("external_provider_id" IS NULL OR btrim("external_provider_id") <> ''),
        CONSTRAINT "CHK_places_opening_time_nonempty"
          CHECK ("opening_time" IS NULL OR btrim("opening_time") <> '')
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_places_status" ON "places" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_places_country_code" ON "places" ("country_code")',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_places_external_provider_id"
      ON "places" ("external_provider_id")
      WHERE "external_provider_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_places_search_document"
      ON "places" USING GIN (to_tsvector('simple', "search_document"))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "places"');
  }
}
