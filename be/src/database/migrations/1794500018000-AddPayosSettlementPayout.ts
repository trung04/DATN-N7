import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayosSettlementPayout1794500018000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE settlement_batches
        DROP CONSTRAINT "CHK_settlement_batches_transfer_mode",
        ADD COLUMN payout_request_id varchar(32),
        ADD COLUMN payout_bank_bin varchar(6),
        ADD COLUMN payout_submitted_at timestamptz,
        ADD CONSTRAINT "CHK_settlement_batches_transfer_mode" CHECK (
          transfer_mode IN ('MANUAL', 'LEGACY_SIMULATED', 'PAYOS')
        ),
        ADD CONSTRAINT "CHK_settlement_payos_request" CHECK (
          transfer_mode <> 'PAYOS' OR (
            payout_request_id IS NOT NULL AND payout_bank_bin IS NOT NULL
            AND status IN ('PROCESSING', 'PAID', 'FAILED')
          )
        )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_settlement_payout_request_id"
        ON settlement_batches (payout_request_id) WHERE payout_request_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_settlement_pending_payos_payout"
        ON settlement_batches (updated_at, id) WHERE transfer_mode = 'PAYOS' AND status = 'PROCESSING'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Restoring the old mode constraint must fail if live payOS payouts exist.
    await queryRunner.query(`
      ALTER TABLE settlement_batches
        DROP CONSTRAINT "CHK_settlement_batches_transfer_mode",
        ADD CONSTRAINT "CHK_settlement_batches_transfer_mode" CHECK (
          transfer_mode IN ('MANUAL', 'LEGACY_SIMULATED')
        ),
        DROP CONSTRAINT "CHK_settlement_payos_request",
        DROP COLUMN payout_request_id,
        DROP COLUMN payout_bank_bin,
        DROP COLUMN payout_submitted_at
    `);
    await queryRunner.query('DROP INDEX "IDX_settlement_pending_payos_payout"');
  }
}
