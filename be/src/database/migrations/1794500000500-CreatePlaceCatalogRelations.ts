import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlaceCatalogRelations1794500000500
  implements MigrationInterface
{
  name = 'CreatePlaceCatalogRelations1794500000500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "place_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(50) NOT NULL,
        "name" varchar(120) NOT NULL,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_place_categories_id" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "UQ_place_categories_code_active"
        ON "place_categories" ("code") WHERE "deleted_at" IS NULL;

      CREATE TABLE "place_category_mappings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "place_id" uuid NOT NULL,
        "place_category_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_place_category_mappings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_place_category_mappings_place"
          FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_place_category_mappings_category"
          FOREIGN KEY ("place_category_id") REFERENCES "place_categories"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "UQ_place_category_mappings_active"
        ON "place_category_mappings" ("place_id", "place_category_id")
        WHERE "deleted_at" IS NULL;
      CREATE INDEX "IDX_place_category_mappings_active_category"
        ON "place_category_mappings" ("place_category_id", "place_id")
        WHERE "deleted_at" IS NULL;

      CREATE TABLE "place_topics" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "place_id" uuid NOT NULL,
        "topic_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_place_topics_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_place_topics_place"
          FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_place_topics_topic"
          FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX "UQ_place_topics_active"
        ON "place_topics" ("place_id", "topic_id") WHERE "deleted_at" IS NULL;
      CREATE INDEX "IDX_place_topics_active_topic"
        ON "place_topics" ("topic_id", "place_id") WHERE "deleted_at" IS NULL;

      CREATE TABLE "reference_prices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "place_id" uuid NOT NULL,
        "cost_type" varchar(60) NOT NULL,
        "min_price" numeric(14,2) NOT NULL,
        "max_price" numeric(14,2) NOT NULL,
        "currency" char(3) NOT NULL DEFAULT 'VND',
        "pricing_unit" varchar(60) NOT NULL,
        "description" text,
        "price_source" varchar(255),
        "confidence_score" numeric(4,3),
        "valid_from" date,
        "valid_until" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_reference_prices_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reference_prices_place"
          FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_reference_prices_range"
          CHECK ("min_price" >= 0 AND "max_price" >= "min_price"),
        CONSTRAINT "CHK_reference_prices_confidence"
          CHECK ("confidence_score" IS NULL OR "confidence_score" BETWEEN 0 AND 1),
        CONSTRAINT "CHK_reference_prices_validity"
          CHECK ("valid_from" IS NULL OR "valid_until" IS NULL OR "valid_until" >= "valid_from")
      );
      CREATE INDEX "IDX_reference_prices_active_place_type"
        ON "reference_prices" ("place_id", "cost_type", "valid_from")
        WHERE "deleted_at" IS NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "reference_prices";
      DROP TABLE "place_topics";
      DROP TABLE "place_category_mappings";
      DROP TABLE "place_categories";
    `);
  }
}
