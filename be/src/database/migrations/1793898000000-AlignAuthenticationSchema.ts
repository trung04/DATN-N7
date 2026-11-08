import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignAuthenticationSchema1793898000000
  implements MigrationInterface
{
  name = 'AlignAuthenticationSchema1793898000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "password_hash" DROP NOT NULL,
        ADD "is_two_factor_enabled" boolean NOT NULL DEFAULT false,
        ADD CONSTRAINT "CHK_users_auth_method"
          CHECK ("password_hash" IS NOT NULL OR "google_account_id" IS NOT NULL);

      DROP INDEX "UQ_users_google_account_id";
      CREATE UNIQUE INDEX "UQ_users_google_account_id"
        ON "users" ("google_account_id")
        WHERE "google_account_id" IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;
      ALTER TABLE "users"
        DROP CONSTRAINT "CHK_users_auth_method",
        DROP COLUMN "is_two_factor_enabled";

      DROP INDEX "UQ_users_google_account_id";
      CREATE UNIQUE INDEX "UQ_users_google_account_id"
        ON "users" ("google_account_id")
        WHERE "google_account_id" IS NOT NULL AND "deleted_at" IS NULL;
    `);
  }
}
