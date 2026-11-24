import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancellationPolicyTiers1794500015000 implements MigrationInterface {
  name = 'AddCancellationPolicyTiers1794500015000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "cancellation_policies" ADD COLUMN "tiers" jsonb');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "cancellation_policies" DROP COLUMN "tiers"');
  }
}
