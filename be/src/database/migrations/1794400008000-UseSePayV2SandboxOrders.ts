import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseSePayV2SandboxOrders1794400008000 implements MigrationInterface {
  name = 'UseSePayV2SandboxOrders1794400008000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN "sepay_order_xid" varchar(100),
        ADD COLUMN "sepay_order_code" varchar(50),
        ADD COLUMN "sepay_va_number" varchar(100),
        ADD COLUMN "sepay_qr_code" text,
        ADD COLUMN "sepay_bank_name" varchar(100),
        ADD COLUMN "sepay_account_number" varchar(100),
        ADD COLUMN "sepay_account_holder_name" varchar(255),
        ADD COLUMN "sepay_order_status" varchar(30),
        ADD COLUMN "sepay_refund_id" varchar(100),
        ADD COLUMN "sepay_refund_idempotency_key" varchar(100),
        ADD COLUMN "sepay_refund_provider_status" varchar(30)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_bookings_sepay_order_code"
      ON "bookings" ("sepay_order_code") WHERE "sepay_order_code" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "UQ_bookings_sepay_order_code"');
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP COLUMN "sepay_order_xid",
        DROP COLUMN "sepay_order_code",
        DROP COLUMN "sepay_va_number",
        DROP COLUMN "sepay_qr_code",
        DROP COLUMN "sepay_bank_name",
        DROP COLUMN "sepay_account_number",
        DROP COLUMN "sepay_account_holder_name",
        DROP COLUMN "sepay_order_status",
        DROP COLUMN "sepay_refund_id",
        DROP COLUMN "sepay_refund_idempotency_key",
        DROP COLUMN "sepay_refund_provider_status"
    `);
  }
}
