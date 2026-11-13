import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillPlaceCatalog1794500001000 implements MigrationInterface {
  name = 'BackfillPlaceCatalog1794500001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "place_categories" ("code", "name", "description") VALUES
        ('ATTRACTION', 'Điểm tham quan', 'Địa điểm và trải nghiệm dành cho khách du lịch'),
        ('RESTAURANT', 'Nhà hàng', 'Địa điểm ăn uống'),
        ('HOTEL', 'Khách sạn', 'Cơ sở lưu trú')
      ON CONFLICT DO NOTHING
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Seed rows are retained because they may be referenced after deployment.
  }
}
