import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSePaySandboxSettlementPayout1794500011000
  implements MigrationInterface
{
  name = 'AddSePaySandboxSettlementPayout1794500011000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settlement_batches" ADD COLUMN "transfer_mode" varchar(40) NOT NULL DEFAULT 'MANUAL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_batches" ADD COLUMN "provider_transfer_id" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_batches" ADD CONSTRAINT "CHK_settlement_batches_transfer_mode" CHECK ("transfer_mode" IN ('MANUAL', 'SEPAY_BANKHUB_SANDBOX'))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_settlement_batches_provider_transfer_id" ON "settlement_batches" ("provider_transfer_id") WHERE "provider_transfer_id" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "UQ_settlement_batches_provider_transfer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_batches" DROP CONSTRAINT "CHK_settlement_batches_transfer_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_batches" DROP COLUMN "provider_transfer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "settlement_batches" DROP COLUMN "transfer_mode"`,
    );
  }
}
