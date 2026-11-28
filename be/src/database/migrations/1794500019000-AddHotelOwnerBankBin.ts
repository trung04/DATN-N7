import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotelOwnerBankBin1794500019000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE hotel_owners
        ADD COLUMN bank_bin varchar(6),
        ADD CONSTRAINT "CHK_hotel_owners_bank_bin" CHECK (
          bank_bin IS NULL OR bank_bin ~ '^[0-9]{6}$'
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE hotel_owners DROP COLUMN bank_bin');
  }
}
