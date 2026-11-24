import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageFallbackUrl1794500012000 implements MigrationInterface {
  name = 'AddImageFallbackUrl1794500012000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "fallback_url" text',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "images" DROP COLUMN IF EXISTS "fallback_url"',
    );
  }
}
