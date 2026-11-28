import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotelCoordinates1794500013000 implements MigrationInterface {
  name = 'AddHotelCoordinates1794500013000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Existing place links may identify an attraction rather than the hotel.
    // Leave coordinates unknown until the property's location is confirmed.
    await queryRunner.query('ALTER TABLE "hotels" ADD COLUMN "latitude" double precision, ADD COLUMN "longitude" double precision');
    await queryRunner.query(`ALTER TABLE "hotels" ADD CONSTRAINT "CHK_hotels_coordinates" CHECK (
      ("latitude" IS NULL AND "longitude" IS NULL) OR
      ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND
       "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "hotels" DROP CONSTRAINT "CHK_hotels_coordinates", DROP COLUMN "longitude", DROP COLUMN "latitude"');
  }
}
