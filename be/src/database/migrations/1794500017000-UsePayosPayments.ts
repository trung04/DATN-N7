import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsePayosPayments1794500017000 implements MigrationInterface {
  name = 'UsePayosPayments1794500017000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bookings
      DROP CONSTRAINT "CHK_bookings_payment_provider",
      ADD COLUMN payment_link_id varchar(64),
      ADD COLUMN payment_checkout_url text,
      ADD COLUMN refund_destination jsonb`);
    await queryRunner.query(`UPDATE bookings SET
      legacy_payment_details = COALESCE(legacy_payment_details, '{}'::jsonb) || '{"retiredProvider":"VNPAY_SANDBOX"}'::jsonb,
      payment_provider = 'LEGACY_TEST'
      WHERE payment_provider = 'VNPAY_SANDBOX'`);
    await queryRunner.query(`ALTER TABLE bookings ADD CONSTRAINT "CHK_bookings_payment_provider"
      CHECK (payment_provider IN ('PAYOS', 'LEGACY_LIVE', 'LEGACY_TEST'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [result] = await queryRunner.query("SELECT EXISTS (SELECT 1 FROM bookings WHERE payment_provider = 'PAYOS') AS present");
    if (result.present) throw new Error('Cannot discard payOS payment history during rollback');
    await queryRunner.query(`ALTER TABLE bookings
      DROP CONSTRAINT "CHK_bookings_payment_provider",
      DROP COLUMN payment_link_id,
      DROP COLUMN payment_checkout_url,
      DROP COLUMN refund_destination`);
    await queryRunner.query(`UPDATE bookings SET
      payment_provider = 'VNPAY_SANDBOX',
      legacy_payment_details = NULLIF(legacy_payment_details - 'retiredProvider', '{}'::jsonb)
      WHERE legacy_payment_details->>'retiredProvider' = 'VNPAY_SANDBOX'`);
    await queryRunner.query(`ALTER TABLE bookings ADD CONSTRAINT "CHK_bookings_payment_provider"
      CHECK (payment_provider IN ('VNPAY_SANDBOX', 'LEGACY_LIVE', 'LEGACY_TEST'))`);
  }
}
