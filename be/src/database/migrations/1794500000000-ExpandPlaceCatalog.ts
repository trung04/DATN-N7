import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandPlaceCatalog1794500000000 implements MigrationInterface {
  name = 'ExpandPlaceCatalog1794500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Support both the original index name and the name used by the
    // already-aligned places schema.
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_places_active_search"; DROP INDEX IF EXISTS "IDX_places_search_document"',
    );
    await queryRunner.query(`
      ALTER TABLE "places"
        DROP COLUMN "search_document",
        ADD "city" varchar(120),
        ADD "review_count" integer NOT NULL DEFAULT 0,
        ADD "estimated_visit_duration_minutes" integer,
        ADD "amenities" text[] NOT NULL DEFAULT '{}',
        ADD "best_visit_times" text[] NOT NULL DEFAULT '{}',
        ADD "suitable_for" text[] NOT NULL DEFAULT '{}',
        ADD "contact_phone" varchar(50),
        ADD "contact_website" text,
        ADD "catalog_version" integer NOT NULL DEFAULT 1,
        ADD "search_document" tsvector GENERATED ALWAYS AS (
          to_tsvector(
            'simple',
            "name" || ' ' ||
            coalesce("description", '') || ' ' ||
            coalesce("address", '') || ' ' ||
            coalesce("city", '') || ' ' ||
            coalesce("province_code", '')
          )
        ) STORED,
        ADD CONSTRAINT "chk_places_review_count" CHECK ("review_count" >= 0),
        ADD CONSTRAINT "chk_places_visit_duration"
          CHECK (
            "estimated_visit_duration_minutes" IS NULL
            OR "estimated_visit_duration_minutes" BETWEEN 5 AND 1440
          ),
        ADD CONSTRAINT "chk_places_catalog_version" CHECK ("catalog_version" > 0)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_places_active_search"
        ON "places" USING GIN ("search_document")
        WHERE "deleted_at" IS NULL AND "status" = 'ACTIVE';
      CREATE INDEX "idx_places_active_city"
        ON "places" ("city", "id")
        WHERE "deleted_at" IS NULL AND "status" = 'ACTIVE';
      CREATE INDEX "idx_places_amenities"
        ON "places" USING GIN ("amenities")
        WHERE "deleted_at" IS NULL;
      CREATE INDEX "idx_places_suitable_for"
        ON "places" USING GIN ("suitable_for")
        WHERE "deleted_at" IS NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "idx_places_suitable_for";
      DROP INDEX "idx_places_amenities";
      DROP INDEX "idx_places_active_city";
      DROP INDEX "idx_places_active_search";
      ALTER TABLE "places"
        DROP CONSTRAINT "chk_places_catalog_version",
        DROP CONSTRAINT "chk_places_visit_duration",
        DROP CONSTRAINT "chk_places_review_count",
        DROP COLUMN "search_document",
        DROP COLUMN "catalog_version",
        DROP COLUMN "contact_website",
        DROP COLUMN "contact_phone",
        DROP COLUMN "suitable_for",
        DROP COLUMN "best_visit_times",
        DROP COLUMN "amenities",
        DROP COLUMN "estimated_visit_duration_minutes",
        DROP COLUMN "review_count",
        DROP COLUMN "city",
        ADD "search_document" tsvector GENERATED ALWAYS AS (
          to_tsvector(
            'simple',
            "name" || ' ' ||
            coalesce("description", '') || ' ' ||
            coalesce("address", '') || ' ' ||
            coalesce("province_code", '')
          )
        ) STORED;
      CREATE INDEX "idx_places_active_search"
        ON "places" USING GIN ("search_document")
        WHERE "deleted_at" IS NULL AND "status" = 'ACTIVE';
    `);
  }
}
