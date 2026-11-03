import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAmenities1793696400000 implements MigrationInterface {
  name = 'CreateAmenities1793696400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "amenities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(50) NOT NULL,
        "name" varchar(120) NOT NULL,
        "type" varchar(60) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_amenities_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_amenities_code" UNIQUE ("code"),
        CONSTRAINT "CHK_amenities_code_format"
          CHECK ("code" ~ '^[A-Z0-9]+(_[A-Z0-9]+)*$'),
        CONSTRAINT "CHK_amenities_name_nonempty" CHECK (btrim("name") <> ''),
        CONSTRAINT "CHK_amenities_type_nonempty" CHECK (btrim("type") <> '')
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_amenities_type" ON "amenities" ("type")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "amenities"');
  }
}
