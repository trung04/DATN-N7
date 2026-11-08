import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingIdempotencyKeys1793697500000 implements MigrationInterface {
  name = 'CreateBookingIdempotencyKeys1793697500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "booking_idempotency_keys" (
        "idempotency_key" uuid NOT NULL,
        "request_hash" char(64) NOT NULL,
        "booking_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        CONSTRAINT "PK_booking_idempotency_keys" PRIMARY KEY ("idempotency_key"),
        CONSTRAINT "UQ_booking_idempotency_keys_booking_id" UNIQUE ("booking_id"),
        CONSTRAINT "FK_booking_idempotency_keys_booking_id_bookings_id"
          FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_booking_idempotency_keys_expires_at" ON "booking_idempotency_keys" ("expires_at")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_booking_idempotency_keys_expires_at"',
    );
    await queryRunner.query('DROP TABLE "booking_idempotency_keys"');
  }
}
