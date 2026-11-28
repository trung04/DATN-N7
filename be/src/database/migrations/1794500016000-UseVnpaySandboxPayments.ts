import { MigrationInterface, QueryRunner } from 'typeorm';

const archivedFields = {
  orderXid: ['sepay_order_xid', 'varchar(100)'],
  orderCode: ['sepay_order_code', 'varchar(50)'],
  vaNumber: ['sepay_va_number', 'varchar(100)'],
  qrCode: ['sepay_qr_code', 'text'],
  bankName: ['sepay_bank_name', 'varchar(100)'],
  accountNumber: ['sepay_account_number', 'varchar(100)'],
  accountHolderName: ['sepay_account_holder_name', 'varchar(255)'],
  orderStatus: ['sepay_order_status', 'varchar(30)'],
  refundId: ['sepay_refund_id', 'varchar(100)'],
  refundKey: ['sepay_refund_idempotency_key', 'varchar(100)'],
  refundStatus: ['sepay_refund_provider_status', 'varchar(30)'],
};

export class UseVnpaySandboxPayments1794500016000 implements MigrationInterface {
  name = 'UseVnpaySandboxPayments1794500016000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bookings
      ADD COLUMN payment_provider varchar(30),
      ADD COLUMN payment_reference varchar(32),
      ADD COLUMN refund_request_id varchar(32),
      ADD COLUMN legacy_payment_details jsonb,
      ADD CONSTRAINT "CHK_bookings_payment_provider"
        CHECK (payment_provider IN ('VNPAY_SANDBOX', 'LEGACY_LIVE', 'LEGACY_TEST'))`);
    const archive = Object.entries(archivedFields).map(([key, [column]]) => `'${key}', "${column}"`).join(', ');
    await queryRunner.query(`UPDATE bookings SET
      legacy_payment_details = NULLIF(jsonb_strip_nulls(jsonb_build_object(${archive})), '{}'::jsonb),
      payment_provider = CASE
        WHEN sepay_order_code LIKE 'BP%' OR sepay_order_code LIKE 'MB%' THEN 'LEGACY_LIVE'
        ELSE 'LEGACY_TEST'
      END
      WHERE sepay_order_code IS NOT NULL OR payment_created_at IS NOT NULL OR payment_transaction_id IS NOT NULL`);
    await queryRunner.query('DROP INDEX "UQ_bookings_sepay_order_code"');
    const drop = Object.values(archivedFields).map(([column]) => `DROP COLUMN "${column}"`).join(', ');
    await queryRunner.query(`ALTER TABLE bookings ${drop}`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_bookings_payment_reference"
      ON bookings (payment_reference) WHERE payment_reference IS NOT NULL`);
    await queryRunner.query('ALTER TABLE settlement_batches DROP CONSTRAINT "CHK_settlement_batches_transfer_mode"');
    await queryRunner.query(`UPDATE settlement_batches SET transfer_mode = 'LEGACY_SIMULATED'
      WHERE transfer_mode = 'SEPAY_BANKHUB_SANDBOX'`);
    await queryRunner.query(`ALTER TABLE settlement_batches ADD CONSTRAINT "CHK_settlement_batches_transfer_mode"
      CHECK (transfer_mode IN ('MANUAL', 'LEGACY_SIMULATED'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [result] = await queryRunner.query(
      "SELECT EXISTS (SELECT 1 FROM bookings WHERE payment_provider = 'VNPAY_SANDBOX') AS present",
    );
    if (result.present) throw new Error('Cannot discard VNPAY payment history during rollback');
    const add = Object.values(archivedFields).map(([column, type]) => `ADD COLUMN "${column}" ${type}`).join(', ');
    await queryRunner.query(`ALTER TABLE bookings ${add}`);
    const restore = Object.entries(archivedFields).map(([key, [column]]) => `"${column}" = legacy_payment_details->>'${key}'`).join(', ');
    await queryRunner.query(`UPDATE bookings SET ${restore} WHERE legacy_payment_details IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_bookings_sepay_order_code"
      ON bookings (sepay_order_code) WHERE sepay_order_code IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE bookings DROP CONSTRAINT "CHK_bookings_payment_provider",
      DROP COLUMN payment_provider, DROP COLUMN payment_reference,
      DROP COLUMN refund_request_id, DROP COLUMN legacy_payment_details`);
    await queryRunner.query('ALTER TABLE settlement_batches DROP CONSTRAINT "CHK_settlement_batches_transfer_mode"');
    await queryRunner.query(`UPDATE settlement_batches SET transfer_mode = 'SEPAY_BANKHUB_SANDBOX'
      WHERE transfer_mode = 'LEGACY_SIMULATED'`);
    await queryRunner.query(`ALTER TABLE settlement_batches ADD CONSTRAINT "CHK_settlement_batches_transfer_mode"
      CHECK (transfer_mode IN ('MANUAL', 'SEPAY_BANKHUB_SANDBOX'))`);
  }
}
