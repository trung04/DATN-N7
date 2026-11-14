import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompleteManualBookingRefundWorkflow1794400007000
  implements MigrationInterface
{
  name = 'CompleteManualBookingRefundWorkflow1794400007000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN "refund_requested_at" timestamptz,
        ADD COLUMN "refund_processing_at" timestamptz,
        ADD COLUMN "refund_attempt" integer NOT NULL DEFAULT 0,
        ADD COLUMN "refund_failure_reason" text,
        ADD COLUMN "refund_failed_at" timestamptz,
        ADD COLUMN "refund_handled_by" uuid
    `);
    await queryRunner.query(`
      UPDATE "bookings"
      SET "refund_requested_at" = COALESCE("cancelled_at", "updated_at", "created_at"),
          "refund_attempt" = 1,
          "refund_failed_at" = CASE
            WHEN "refund_status" = 'FAILED' THEN "updated_at"
            ELSE NULL
          END,
          "refund_failure_reason" = CASE
            WHEN "refund_status" = 'FAILED' THEN 'Lý do thất bại chưa được ghi nhận trước đây.'
            ELSE NULL
          END
      WHERE "refund_status" IN ('PENDING', 'REFUNDED', 'FAILED')
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_refund_status",
        ADD CONSTRAINT "CHK_bookings_refund_status"
          CHECK ("refund_status" IN ('NONE', 'PENDING', 'PROCESSING', 'REFUNDED', 'FAILED')),
        ADD CONSTRAINT "CHK_bookings_refund_attempt"
          CHECK ("refund_attempt" >= 0),
        ADD CONSTRAINT "FK_bookings_refund_handled_by_users_id"
          FOREIGN KEY ("refund_handled_by") REFERENCES "users"("id")
          ON UPDATE NO ACTION ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_refund_status_requested_at"
      ON "bookings" ("refund_status", "refund_requested_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_bookings_refund_status_requested_at"',
    );
    await queryRunner.query(`
      UPDATE "bookings"
      SET "refund_status" = 'PENDING'
      WHERE "refund_status" = 'PROCESSING'
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "FK_bookings_refund_handled_by_users_id",
        DROP CONSTRAINT "CHK_bookings_refund_attempt",
        DROP CONSTRAINT "CHK_bookings_refund_status",
        ADD CONSTRAINT "CHK_bookings_refund_status"
          CHECK ("refund_status" IN ('NONE', 'PENDING', 'REFUNDED', 'FAILED')),
        DROP COLUMN "refund_requested_at",
        DROP COLUMN "refund_processing_at",
        DROP COLUMN "refund_attempt",
        DROP COLUMN "refund_failure_reason",
        DROP COLUMN "refund_failed_at",
        DROP COLUMN "refund_handled_by"
    `);
  }
}
