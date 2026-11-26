import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTwoFactorCredentials1794500018000
  implements MigrationInterface
{
  name = 'CreateUserTwoFactorCredentials1794500018000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_two_factor_credentials" (
        "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
        "encrypted_secret" text NOT NULL,
        "recovery_code_hashes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_user_two_factor_recovery_codes_array"
          CHECK (jsonb_typeof("recovery_code_hashes") = 'array')
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "user_two_factor_credentials"');
  }
}
