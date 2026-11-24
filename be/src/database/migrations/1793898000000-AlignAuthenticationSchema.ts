import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignAuthenticationSchema1793898000000 implements MigrationInterface {
  name = 'AlignAuthenticationSchema1793898000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "password_hash" DROP NOT NULL,
        ADD CONSTRAINT "CHK_users_auth_method"
          CHECK ("password_hash" IS NOT NULL OR "google_account_id" IS NOT NULL);

      DROP INDEX "UQ_users_google_account_id";
      CREATE UNIQUE INDEX "UQ_users_google_account_id"
        ON "users" ("google_account_id")
        WHERE "google_account_id" IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // shortcut: rollback requires removing Google-only users first, add an archival migration if rollback is needed after launch.
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT "CHK_users_auth_method";
      ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;

      DROP INDEX "UQ_users_google_account_id";
      CREATE UNIQUE INDEX "UQ_users_google_account_id"
        ON "users" ("google_account_id")
        WHERE "google_account_id" IS NOT NULL AND "deleted_at" IS NULL;
    `);
  }
}
