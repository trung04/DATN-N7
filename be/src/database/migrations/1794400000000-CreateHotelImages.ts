import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHotelImages1794400000000 implements MigrationInterface {
  name = 'CreateHotelImages1794400000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "hotel_images" (
      "id" uuid NOT NULL,
      "hotel_id" uuid NOT NULL,
      "object_key" varchar(200) NOT NULL UNIQUE,
      "content_type" varchar(50) NOT NULL,
      "byte_size" integer NOT NULL CHECK ("byte_size" > 0 AND "byte_size" <= 5242880),
      "width" integer NOT NULL CHECK ("width" > 0),
      "height" integer NOT NULL CHECK ("height" > 0),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_hotel_images" PRIMARY KEY ("id"),
      CONSTRAINT "FK_hotel_images_hotel" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_images_hotel_created" ON "hotel_images" ("hotel_id", "created_at")',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "hotel_images"');
  }
}
