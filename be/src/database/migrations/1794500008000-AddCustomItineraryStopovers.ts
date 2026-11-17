import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomItineraryStopovers1794500008000
  implements MigrationInterface
{
  name = 'AddCustomItineraryStopovers1794500008000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stopovers"
        ALTER COLUMN "place_id" DROP NOT NULL,
        ADD COLUMN "custom_name" varchar(200),
        ADD COLUMN "custom_address" text,
        ADD COLUMN "latitude" double precision,
        ADD COLUMN "longitude" double precision,
        ADD CONSTRAINT "CHK_stopovers_custom_location"
          CHECK (
            "place_id" IS NOT NULL OR (
              "custom_name" IS NOT NULL
              AND length(trim("custom_name")) > 0
              AND "latitude" IS NOT NULL
              AND "latitude" BETWEEN -90 AND 90
              AND "longitude" IS NOT NULL
              AND "longitude" BETWEEN -180 AND 180
            )
          );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stopovers"
        DROP CONSTRAINT "CHK_stopovers_custom_location";
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "stopovers" WHERE "place_id" IS NULL) THEN
          RAISE EXCEPTION 'Cannot reverse custom stopovers while custom stops exist';
        END IF;
      END $$;
      ALTER TABLE "stopovers"
        ALTER COLUMN "place_id" SET NOT NULL,
        DROP COLUMN "custom_name",
        DROP COLUMN "custom_address",
        DROP COLUMN "latitude",
        DROP COLUMN "longitude";
    `);
  }
}
