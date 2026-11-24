import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseHoursAfterBookingForCancellation1794400005000
  implements MigrationInterface
{
  name = 'UseHoursAfterBookingForCancellation1794400005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        DROP CONSTRAINT "CHK_cancellation_policies_hours_range"
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        RENAME COLUMN "min_hours_before_check_in" TO "min_hours_after_booking"
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        RENAME COLUMN "max_hours_before_check_in" TO "max_hours_after_booking"
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        ADD CONSTRAINT "CHK_cancellation_policies_hours_after_booking_range"
        CHECK ("min_hours_after_booking" >= 0 AND
          ("max_hours_after_booking" IS NULL OR
           "max_hours_after_booking" > "min_hours_after_booking"))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        DROP CONSTRAINT "CHK_cancellation_policies_hours_after_booking_range"
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        RENAME COLUMN "max_hours_after_booking" TO "max_hours_before_check_in"
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        RENAME COLUMN "min_hours_after_booking" TO "min_hours_before_check_in"
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        ADD CONSTRAINT "CHK_cancellation_policies_hours_range"
        CHECK ("min_hours_before_check_in" >= 0 AND
          ("max_hours_before_check_in" IS NULL OR
           "max_hours_before_check_in" > "min_hours_before_check_in"))
    `);
  }
}
