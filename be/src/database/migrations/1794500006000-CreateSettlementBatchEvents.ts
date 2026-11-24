import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSettlementBatchEvents1794500006000 implements MigrationInterface {
  name = 'CreateSettlementBatchEvents1794500006000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "settlement_batch_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "settlement_batch_id" uuid NOT NULL,
        "from_status" varchar(20),
        "to_status" varchar(20) NOT NULL,
        "actor_user_id" uuid,
        "note" text,
        "transfer_reference" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_settlement_batch_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_settlement_batch_events_batch" FOREIGN KEY ("settlement_batch_id")
          REFERENCES "settlement_batches"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_settlement_batch_events_to_status" CHECK
          ("to_status" IN ('DRAFT','APPROVED','PROCESSING','PAID','FAILED'))
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_settlement_batch_events_batch_created" ON "settlement_batch_events" ("settlement_batch_id", "created_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "settlement_batch_events"`);
  }
}
