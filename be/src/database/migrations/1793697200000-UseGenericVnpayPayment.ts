import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseGenericVnpayPayment1793697200000 implements MigrationInterface {
  name = 'UseGenericVnpayPayment1793697200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_payment_status"',
    );
    await queryRunner.query(`
      UPDATE "bookings"
      SET "payment_status" = 'PAYMENT_PENDING'
      WHERE "payment_status" = 'QR_PENDING'
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD CONSTRAINT "CHK_bookings_payment_status"
      CHECK ("payment_status" IN ('PENDING', 'PAYMENT_PENDING', 'PAID', 'FAILED', 'EXPIRED'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_payment_status"',
    );
    await queryRunner.query(`
      UPDATE "bookings"
      SET "payment_status" = 'QR_PENDING'
      WHERE "payment_status" = 'PAYMENT_PENDING'
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD CONSTRAINT "CHK_bookings_payment_status"
      CHECK ("payment_status" IN ('PENDING', 'QR_PENDING', 'PAID', 'FAILED', 'EXPIRED'))
    `);
  }
}
