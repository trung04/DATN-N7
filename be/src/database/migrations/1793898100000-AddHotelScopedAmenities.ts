import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotelScopedAmenities1793898100000
  implements MigrationInterface
{
  name = 'AddHotelScopedAmenities1793898100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "amenities" ADD "hotel_id" uuid;
      ALTER TABLE "amenities"
        ADD CONSTRAINT "FK_amenities_hotel_id_hotels_id"
        FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT;
      DROP INDEX "UQ_amenities_code";
      CREATE UNIQUE INDEX "UQ_amenities_global_code"
        ON "amenities" ("code")
        WHERE "deleted_at" IS NULL AND "hotel_id" IS NULL;
      CREATE UNIQUE INDEX "UQ_amenities_hotel_code"
        ON "amenities" ("hotel_id", "code")
        WHERE "deleted_at" IS NULL AND "hotel_id" IS NOT NULL;
      CREATE INDEX "IDX_amenities_hotel_id"
        ON "amenities" ("hotel_id") WHERE "deleted_at" IS NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "room_amenities"
        WHERE "amenity_id" IN (SELECT "id" FROM "amenities" WHERE "hotel_id" IS NOT NULL);
      DELETE FROM "amenities" WHERE "hotel_id" IS NOT NULL;
      DROP INDEX "IDX_amenities_hotel_id";
      DROP INDEX "UQ_amenities_hotel_code";
      DROP INDEX "UQ_amenities_global_code";
      ALTER TABLE "amenities" DROP CONSTRAINT "FK_amenities_hotel_id_hotels_id";
      ALTER TABLE "amenities" DROP COLUMN "hotel_id";
      CREATE UNIQUE INDEX "UQ_amenities_code"
        ON "amenities" ("code") WHERE "deleted_at" IS NULL;
    `);
  }
}
