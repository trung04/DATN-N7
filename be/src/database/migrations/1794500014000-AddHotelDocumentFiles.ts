import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotelDocumentFiles1794500014000 implements MigrationInterface {
  name = 'AddHotelDocumentFiles1794500014000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE hotel_documents ADD COLUMN files jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await queryRunner.query(`ALTER TABLE hotel_documents ADD CONSTRAINT "CHK_hotel_document_files" CHECK (jsonb_typeof(files) = 'array' AND jsonb_array_length(files) <= 3)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE hotel_documents DROP CONSTRAINT "CHK_hotel_document_files", DROP COLUMN files');
  }
}
