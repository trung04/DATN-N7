import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotelOwnerTimestamps1794400002000 implements MigrationInterface {
  name = 'AddHotelOwnerTimestamps1794400002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hotel_owners"
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now()`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hotel_owners"
      DROP COLUMN "updated_at", DROP COLUMN "created_at"`);
  }
}
