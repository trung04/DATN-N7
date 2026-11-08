import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingReservationExpiry1793697400000 implements MigrationInterface {
  name = 'AddBookingReservationExpiry1793697400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "bookings" ADD COLUMN "reservation_expires_at" timestamptz',
    );
    await queryRunner.query(`
      UPDATE "bookings"
      SET "reservation_expires_at" = COALESCE(
        "payment_expires_at",
        "created_at" + interval '15 minutes'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ALTER COLUMN "reservation_expires_at" SET NOT NULL,
        ADD CONSTRAINT "CHK_bookings_reservation_expiry"
          CHECK ("reservation_expires_at" > "created_at")
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_bookings_reservation_expires_at" ON "bookings" ("reservation_expires_at")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_bookings_reservation_expires_at"');
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_reservation_expiry",
        DROP COLUMN "reservation_expires_at"
    `);
  }
}
