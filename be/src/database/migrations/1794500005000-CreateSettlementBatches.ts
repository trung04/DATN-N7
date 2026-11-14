import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSettlementBatches1794500005000 implements MigrationInterface {
  name = 'CreateSettlementBatches1794500005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "settlement_batches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "hotel_id" uuid NOT NULL,
        "hotel_name_snapshot" varchar(200) NOT NULL,
        "owner_user_id" uuid NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "currency" varchar(10) NOT NULL,
        "booking_count" integer NOT NULL,
        "gross_amount" numeric(14,2) NOT NULL,
        "commission_amount" numeric(14,2) NOT NULL,
        "adjustment_amount" numeric(14,2) NOT NULL DEFAULT 0,
        "net_amount" numeric(14,2) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
        "bank_name_snapshot" varchar(100) NOT NULL,
        "bank_account_number_snapshot" varchar(100) NOT NULL,
        "bank_account_holder_snapshot" varchar(255) NOT NULL,
        "approved_by" uuid,
        "approved_at" timestamptz,
        "processing_at" timestamptz,
        "paid_at" timestamptz,
        "failed_at" timestamptz,
        "failure_reason" text,
        "transfer_reference" varchar(255),
        "revision" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_settlement_batches_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_settlement_batches_hotel_period" UNIQUE ("hotel_id", "period_start", "period_end"),
        CONSTRAINT "UQ_settlement_batches_transfer_reference" UNIQUE ("transfer_reference"),
        CONSTRAINT "CHK_settlement_batches_period" CHECK ("period_end" >= "period_start"),
        CONSTRAINT "CHK_settlement_batches_count" CHECK ("booking_count" > 0),
        CONSTRAINT "CHK_settlement_batches_money" CHECK (
          "gross_amount" >= 0 AND "commission_amount" >= 0 AND
          "adjustment_amount" >= 0 AND "net_amount" >= 0 AND
          "gross_amount" - "commission_amount" - "adjustment_amount" = "net_amount"
        ),
        CONSTRAINT "CHK_settlement_batches_status" CHECK ("status" IN ('DRAFT','APPROVED','PROCESSING','PAID','FAILED')),
        CONSTRAINT "CHK_settlement_batches_paid_fields" CHECK (
          "status" <> 'PAID' OR ("paid_at" IS NOT NULL AND "transfer_reference" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "settlement_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "settlement_batch_id" uuid NOT NULL,
        "booking_id" uuid NOT NULL,
        "booking_code_snapshot" varchar(50) NOT NULL,
        "check_out_date_snapshot" date NOT NULL,
        "payment_reference_snapshot" varchar(255),
        "currency_snapshot" varchar(10) NOT NULL,
        "gross_amount" numeric(14,2) NOT NULL,
        "commission_rate_snapshot" numeric(5,2) NOT NULL,
        "commission_amount" numeric(14,2) NOT NULL,
        "net_amount" numeric(14,2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_settlement_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_settlement_items_batch" FOREIGN KEY ("settlement_batch_id")
          REFERENCES "settlement_batches"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_settlement_items_booking" FOREIGN KEY ("booking_id")
          REFERENCES "bookings"("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_settlement_items_booking" UNIQUE ("booking_id"),
        CONSTRAINT "CHK_settlement_items_money" CHECK (
          "gross_amount" >= 0 AND "commission_amount" >= 0 AND "net_amount" >= 0 AND
          "gross_amount" - "commission_amount" = "net_amount" AND
          "commission_rate_snapshot" BETWEEN 0 AND 100
        )
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_settlement_batches_status_created" ON "settlement_batches" ("status", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_settlement_items_batch" ON "settlement_items" ("settlement_batch_id")`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_bookings_settlement_transaction_id"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_bookings_settlement_transaction_id" ON "bookings" ("transaction_id") WHERE "transaction_id" IS NOT NULL`);
    await queryRunner.query(`DROP TABLE "settlement_items"`);
    await queryRunner.query(`DROP TABLE "settlement_batches"`);
  }
}
