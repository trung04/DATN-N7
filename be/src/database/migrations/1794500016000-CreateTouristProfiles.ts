import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTouristProfiles1794500016000 implements MigrationInterface {
  name = 'CreateTouristProfiles1794500016000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tourists" (
        "user_id" uuid NOT NULL,
        "bio" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_tourists_user_id" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_tourists_user_id_users_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      INSERT INTO "tourists" ("user_id")
      SELECT "id" FROM "users"
      WHERE "role" = 'TOURIST' AND "deleted_at" IS NULL
      ON CONFLICT ("user_id") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "tourists"');
  }
}
