import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingSettings1794500020000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE booking_settings (
        id smallint PRIMARY KEY CHECK (id = 1),
        commission_rate numeric(5,2) NOT NULL CHECK (commission_rate BETWEEN 0 AND 100),
        updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE booking_settings');
  }
}
