import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTwoFactorFlag1794400001000 implements MigrationInterface {
  name = 'AddUserTwoFactorFlag1794400001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_two_factor_enabled" boolean NOT NULL DEFAULT false',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "is_two_factor_enabled"',
    );
  }
}
