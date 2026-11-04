import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCancellationPolicies1793697000000 implements MigrationInterface {
  name = 'CreateCancellationPolicies1793697000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cancellation_policies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "hotel_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "cancellation_window" integer,
        "cancellation_fee_rate" numeric(5,2),
        "description" text,
        CONSTRAINT "PK_cancellation_policies_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_cancellation_policies_name_nonempty"
          CHECK (btrim("name") <> ''),
        CONSTRAINT "CHK_cancellation_policies_window"
          CHECK ("cancellation_window" IS NULL OR "cancellation_window" BETWEEN 0 AND 3650),
        CONSTRAINT "CHK_cancellation_policies_fee_rate"
          CHECK ("cancellation_fee_rate" IS NULL OR "cancellation_fee_rate" BETWEEN 0 AND 100)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_cancellation_policies_hotel_id" ON "cancellation_policies" ("hotel_id")',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cancellation_policies_hotel_name_lower"
      ON "cancellation_policies" ("hotel_id", LOWER("name"))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "cancellation_policies"');
  }
}
