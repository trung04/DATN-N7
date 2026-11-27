import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaceSpatialViewportIndex1794500019000
  implements MigrationInterface
{
  name = 'AddPlaceSpatialViewportIndex1794500019000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await queryRunner.query(`
      ALTER TABLE "places"
        ADD "location" geography(Point, 4326)
        GENERATED ALWAYS AS (
          CASE
            WHEN "latitude" IS NULL OR "longitude" IS NULL THEN NULL
            ELSE ST_SetSRID(
              ST_MakePoint("longitude"::double precision, "latitude"::double precision),
              4326
            )::geography
          END
        ) STORED
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_places_active_location"
        ON "places" USING GIST ("location")
        WHERE "deleted_at" IS NULL AND "status" = 'ACTIVE'
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_places_active_map_rank"
        ON "places" ("average_rating" DESC, "review_count" DESC, "id")
        WHERE "deleted_at" IS NULL AND "status" = 'ACTIVE'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_places_active_map_rank"');
    await queryRunner.query('DROP INDEX "IDX_places_active_location"');
    await queryRunner.query('ALTER TABLE "places" DROP COLUMN "location"');
  }
}
