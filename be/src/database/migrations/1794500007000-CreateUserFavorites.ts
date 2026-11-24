import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserFavorites1794500007000 implements MigrationInterface {
  name = 'CreateUserFavorites1794500007000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_favorites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "target_type" varchar(16) NOT NULL,
        "target_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_favorites_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_favorites_user_id_users_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_user_favorites_target_type" CHECK ("target_type" IN ('PLACE', 'HOTEL'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_user_favorites_user_target"
      ON "user_favorites" ("user_id", "target_type", "target_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "user_favorites"');
  }
}
