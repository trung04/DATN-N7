import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddItineraryDestinationCity1794500004000
  implements MigrationInterface
{
  name = 'AddItineraryDestinationCity1794500004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itineraries" ADD "destination_city" varchar(120)`,
    );
    await queryRunner.query(
      `UPDATE "itineraries" SET "destination_city" = 'Chưa xác định'`,
    );
    await queryRunner.query(
      `ALTER TABLE "itineraries" ALTER COLUMN "destination_city" SET NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itineraries" DROP COLUMN "destination_city"`,
    );
  }
}
