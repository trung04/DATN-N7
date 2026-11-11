import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancellationPolicyRanges1793898200000 implements MigrationInterface {
  name = 'AddCancellationPolicyRanges1793898200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        ADD COLUMN "min_hours_before_check_in" integer NOT NULL DEFAULT 0,
        ADD COLUMN "max_hours_before_check_in" integer
    `);
    await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN "cancellation_fee_amount" numeric(12,2)`);
    // Preserve the legacy cutoff by treating the existing policy as eligible
    // from check-in until its configured cutoff.
    await queryRunner.query(`
      UPDATE "cancellation_policies"
      SET "max_hours_before_check_in" = "cancellation_window"
      WHERE "cancellation_window" IS NOT NULL AND "cancellation_window" > 0
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
      ADD CONSTRAINT "CHK_cancellation_policies_hours_range"
      CHECK ("min_hours_before_check_in" >= 0 AND
        ("max_hours_before_check_in" IS NULL OR
         "max_hours_before_check_in" > "min_hours_before_check_in"))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "cancellation_fee_amount"`);
    await queryRunner.query(`ALTER TABLE "cancellation_policies"
      DROP CONSTRAINT "CHK_cancellation_policies_hours_range",
      DROP COLUMN "max_hours_before_check_in",
      DROP COLUMN "min_hours_before_check_in"`);
  }
}
