import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1793696700000 implements MigrationInterface {
  name = 'CreateUsers1793696700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "username" varchar(50) NOT NULL,
        "email" varchar(254) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "google_account_id" varchar(255),
        "first_name" varchar(100),
        "last_name" varchar(100),
        "display_name" varchar(150),
        "phone_number" varchar(20),
        "date_of_birth" date,
        "gender" varchar(20),
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "is_email_verified" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_users_username_format"
          CHECK ("username" ~ '^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$'),
        CONSTRAINT "CHK_users_email_nonempty" CHECK (btrim("email") <> ''),
        CONSTRAINT "CHK_users_phone_format"
          CHECK ("phone_number" IS NULL OR "phone_number" ~ '^\\+?[0-9]{8,15}$'),
        CONSTRAINT "CHK_users_gender"
          CHECK ("gender" IS NULL OR "gender" IN ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED')),
        CONSTRAINT "CHK_users_status"
          CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_users_username_lower" ON "users" (LOWER("username"))',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_users_email_lower" ON "users" (LOWER("email"))',
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_google_account_id"
       ON "users" ("google_account_id")
       WHERE "google_account_id" IS NOT NULL`,
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_users_status" ON "users" ("status")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "users"');
  }
}
