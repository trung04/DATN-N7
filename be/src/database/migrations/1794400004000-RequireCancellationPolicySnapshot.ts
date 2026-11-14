import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequireCancellationPolicySnapshot1794400004000 implements MigrationInterface {
  name = 'RequireCancellationPolicySnapshot1794400004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        ADD COLUMN "cancellation_allowed" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      UPDATE "cancellation_policies"
      SET "cancellation_fee_rate" = 0
      WHERE "cancellation_allowed" = true AND "cancellation_fee_rate" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        ADD CONSTRAINT "CHK_cancellation_policy_fee_required"
        CHECK ("cancellation_allowed" = false OR "cancellation_fee_rate" IS NOT NULL)
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN "cancellation_policy_snapshot" jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP COLUMN "cancellation_policy_snapshot"
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        DROP CONSTRAINT "CHK_cancellation_policy_fee_required",
        DROP COLUMN "cancellation_allowed"
    `);
  }
}
