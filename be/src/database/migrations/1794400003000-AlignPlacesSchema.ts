import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignPlacesSchema1794400003000 implements MigrationInterface {
  name = 'AlignPlacesSchema1794400003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_places_search_document";
      ALTER TABLE "places" DROP CONSTRAINT IF EXISTS "CHK_places_opening_time_nonempty";
      ALTER TABLE "places" DROP COLUMN "search_document";
      ALTER TABLE "places" RENAME COLUMN "external_provider_id" TO "provider_place_id";
      ALTER TABLE "places" RENAME COLUMN "opening_time" TO "opening_times";
      ALTER TABLE "places"
        ALTER COLUMN "opening_times" TYPE jsonb
        USING CASE
          WHEN "opening_times" IS NULL THEN NULL
          ELSE jsonb_build_object('display', "opening_times")
        END;

      ALTER TABLE "places"
        ADD COLUMN "source_type" varchar(20) NOT NULL DEFAULT 'MANUAL',
        ADD COLUMN "source_provider" varchar(50),
        ADD COLUMN "source_url" text,
        ADD COLUMN "attribution_text" text,
        ADD COLUMN "license_code" varchar(50),
        ADD COLUMN "last_refreshed_at" timestamptz,
        ADD COLUMN "created_at" timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN "deleted_at" timestamptz;

      ALTER TABLE "places"
        ADD CONSTRAINT "CHK_places_source_type"
          CHECK ("source_type" IN ('MANUAL', 'CRAWLED', 'PROVIDER')),
        ADD CONSTRAINT "CHK_places_opening_times_display"
          CHECK ("opening_times" IS NULL OR jsonb_typeof("opening_times") = 'object');

      ALTER TABLE "places"
        RENAME CONSTRAINT "CHK_places_external_provider_nonempty"
        TO "CHK_places_provider_place_id_nonempty";
      ALTER INDEX "UQ_places_external_provider_id"
        RENAME TO "UQ_places_provider_place_id";

      ALTER TABLE "places"
        ADD COLUMN "search_document" tsvector GENERATED ALWAYS AS (
          to_tsvector(
            'simple'::regconfig,
            lower(
              "name" || ' ' ||
              coalesce("description", '') || ' ' ||
              coalesce("address", '') || ' ' ||
              coalesce("country_code", '') || ' ' ||
              coalesce("province_code", '')
            )
          )
        ) STORED;
      CREATE INDEX "IDX_places_search_document"
        ON "places" USING GIN ("search_document");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_places_search_document";
      ALTER TABLE "places"
        DROP CONSTRAINT "CHK_places_source_type",
        DROP CONSTRAINT "CHK_places_opening_times_display";
      ALTER TABLE "places" DROP COLUMN "search_document";
      ALTER TABLE "places"
        ADD COLUMN "search_document" text GENERATED ALWAYS AS (
          lower(
            "name" || ' ' ||
            coalesce("description", '') || ' ' ||
            coalesce("address", '') || ' ' ||
            coalesce("country_code", '') || ' ' ||
            coalesce("province_code", '')
          )
        ) STORED;
      CREATE INDEX "IDX_places_search_document"
        ON "places" USING GIN (to_tsvector('simple', "search_document"));

      ALTER INDEX "UQ_places_provider_place_id"
        RENAME TO "UQ_places_external_provider_id";
      ALTER TABLE "places"
        RENAME CONSTRAINT "CHK_places_provider_place_id_nonempty"
        TO "CHK_places_external_provider_nonempty";

      ALTER TABLE "places" RENAME COLUMN "provider_place_id" TO "external_provider_id";
      ALTER TABLE "places"
        ALTER COLUMN "opening_times" TYPE varchar(255)
        USING "opening_times" ->> 'display';
      ALTER TABLE "places" RENAME COLUMN "opening_times" TO "opening_time";
      ALTER TABLE "places"
        ADD CONSTRAINT "CHK_places_opening_time_nonempty"
        CHECK ("opening_time" IS NULL OR btrim("opening_time") <> '');

      ALTER TABLE "places"
        DROP COLUMN "deleted_at",
        DROP COLUMN "updated_at",
        DROP COLUMN "created_at",
        DROP COLUMN "last_refreshed_at",
        DROP COLUMN "license_code",
        DROP COLUMN "attribution_text",
        DROP COLUMN "source_url",
        DROP COLUMN "source_provider",
        DROP COLUMN "source_type";
    `);
  }
}
