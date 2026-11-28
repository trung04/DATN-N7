import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformSettings1794500021000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE platform_settings (
      section varchar(30) PRIMARY KEY,
      encrypted_value text NOT NULL,
      revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
      updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE platform_settings');
  }
}
