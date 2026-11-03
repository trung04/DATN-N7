import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAmenityType1793696500000 implements MigrationInterface {
  name = 'RemoveAmenityType1793696500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_amenities_type"');
    await queryRunner.query(
      'ALTER TABLE "amenities" DROP CONSTRAINT IF EXISTS "CHK_amenities_type_nonempty"',
    );
    await queryRunner.query('ALTER TABLE "amenities" DROP COLUMN "type"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "amenities"
       ADD COLUMN "type" varchar(60) NOT NULL DEFAULT 'GENERAL'`,
    );
    await queryRunner.query(
      'ALTER TABLE "amenities" ALTER COLUMN "type" DROP DEFAULT',
    );
    await queryRunner.query(
      `ALTER TABLE "amenities"
       ADD CONSTRAINT "CHK_amenities_type_nonempty"
       CHECK (btrim("type") <> '')`,
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_amenities_type" ON "amenities" ("type")',
    );
  }
}
