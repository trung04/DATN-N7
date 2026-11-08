import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookings1793697100000 implements MigrationInterface {
  name = 'CreateBookings1793697100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "hotel_id" uuid NOT NULL,
        "tourist_id" uuid NOT NULL,
        "booking_code" varchar(50) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "adult_count" integer NOT NULL,
        "child_count" integer NOT NULL DEFAULT 0,
        "guest_name" varchar(255) NOT NULL,
        "special_requests" text,
        "booking_status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "total_amount" numeric(12,2) NOT NULL,
        "currency" varchar(10) NOT NULL DEFAULT 'VND',
        "applied_commission_rate" numeric(5,2) NOT NULL DEFAULT 0,
        "amount" numeric(12,2) NOT NULL,
        "payment_method" varchar(30),
        "qr_created_at" timestamptz,
        "qr_expires_at" timestamptz,
        "payment_status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "paid_at" timestamptz,
        "payment_transaction_id" varchar(255),
        "settlement_base_amount" numeric(12,2),
        "commission_amount" numeric(12,2),
        "partner_receivable_amount" numeric(12,2),
        "settlement_status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "transaction_id" varchar(255),
        "bank_name_snapshot" varchar(255),
        "bank_account_number_snapshot" varchar(255),
        "bank_account_holder_snapshot" varchar(255),
        "settled_at" timestamptz,
        "cancellation_policy_id" uuid,
        "refund_amount" numeric(12,2),
        "refund_reason" text,
        "refund_status" varchar(30) NOT NULL DEFAULT 'NONE',
        "refunded_at" timestamptz,
        "refund_transaction_id" varchar(255),
        CONSTRAINT "PK_bookings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bookings_booking_code" UNIQUE ("booking_code"),
        CONSTRAINT "CHK_bookings_booking_code_nonempty"
          CHECK (btrim("booking_code") <> ''),
        CONSTRAINT "CHK_bookings_adult_count"
          CHECK ("adult_count" BETWEEN 1 AND 100),
        CONSTRAINT "CHK_bookings_child_count"
          CHECK ("child_count" BETWEEN 0 AND 100),
        CONSTRAINT "CHK_bookings_guest_name_nonempty"
          CHECK (btrim("guest_name") <> ''),
        CONSTRAINT "CHK_bookings_booking_status"
          CHECK ("booking_status" IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
        CONSTRAINT "CHK_bookings_total_amount"
          CHECK ("total_amount" >= 0),
        CONSTRAINT "CHK_bookings_currency"
          CHECK ("currency" ~ '^[A-Z]{3,10}$'),
        CONSTRAINT "CHK_bookings_commission_rate"
          CHECK ("applied_commission_rate" BETWEEN 0 AND 100),
        CONSTRAINT "CHK_bookings_amount"
          CHECK ("amount" >= 0),
        CONSTRAINT "CHK_bookings_payment_method"
          CHECK ("payment_method" IS NULL OR "payment_method" IN ('QR', 'CARD', 'BANK_TRANSFER', 'CASH')),
        CONSTRAINT "CHK_bookings_payment_status"
          CHECK ("payment_status" IN ('PENDING', 'QR_PENDING', 'PAID', 'FAILED', 'EXPIRED')),
        CONSTRAINT "CHK_bookings_qr_timestamps"
          CHECK (
            ("qr_created_at" IS NULL AND "qr_expires_at" IS NULL)
            OR ("qr_created_at" IS NOT NULL AND "qr_expires_at" > "qr_created_at")
          ),
        CONSTRAINT "CHK_bookings_paid_fields"
          CHECK (
            "payment_status" <> 'PAID'
            OR ("paid_at" IS NOT NULL AND "payment_transaction_id" IS NOT NULL)
          ),
        CONSTRAINT "CHK_bookings_settlement_amounts"
          CHECK (
            ("settlement_base_amount" IS NULL AND "commission_amount" IS NULL AND "partner_receivable_amount" IS NULL)
            OR (
              "settlement_base_amount" >= 0
              AND "commission_amount" >= 0
              AND "partner_receivable_amount" >= 0
              AND "settlement_base_amount" = "commission_amount" + "partner_receivable_amount"
            )
          ),
        CONSTRAINT "CHK_bookings_settlement_status"
          CHECK ("settlement_status" IN ('PENDING', 'PROCESSING', 'SETTLED', 'FAILED')),
        CONSTRAINT "CHK_bookings_settled_fields"
          CHECK (
            "settlement_status" <> 'SETTLED'
            OR (
              "transaction_id" IS NOT NULL
              AND "bank_name_snapshot" IS NOT NULL
              AND "bank_account_number_snapshot" IS NOT NULL
              AND "bank_account_holder_snapshot" IS NOT NULL
              AND "settled_at" IS NOT NULL
            )
          ),
        CONSTRAINT "CHK_bookings_refund_amount"
          CHECK ("refund_amount" IS NULL OR ("refund_amount" >= 0 AND "refund_amount" <= "amount")),
        CONSTRAINT "CHK_bookings_refund_status"
          CHECK ("refund_status" IN ('NONE', 'PENDING', 'REFUNDED', 'FAILED')),
        CONSTRAINT "CHK_bookings_refunded_fields"
          CHECK (
            "refund_status" <> 'REFUNDED'
            OR (
              "refund_amount" IS NOT NULL
              AND "refund_reason" IS NOT NULL
              AND "refunded_at" IS NOT NULL
              AND "refund_transaction_id" IS NOT NULL
            )
          ),
        CONSTRAINT "FK_bookings_cancellation_policy_id_cancellation_policies_id"
          FOREIGN KEY ("cancellation_policy_id")
          REFERENCES "cancellation_policies"("id")
          ON UPDATE NO ACTION ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_bookings_hotel_id" ON "bookings" ("hotel_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_bookings_tourist_id" ON "bookings" ("tourist_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_bookings_booking_status" ON "bookings" ("booking_status")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_bookings_payment_status" ON "bookings" ("payment_status")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_bookings_created_at" ON "bookings" ("created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_bookings_cancellation_policy_id" ON "bookings" ("cancellation_policy_id")',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_bookings_payment_transaction_id"
      ON "bookings" ("payment_transaction_id")
      WHERE "payment_transaction_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_bookings_settlement_transaction_id"
      ON "bookings" ("transaction_id")
      WHERE "transaction_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_bookings_refund_transaction_id"
      ON "bookings" ("refund_transaction_id")
      WHERE "refund_transaction_id" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "bookings"');
  }
}
