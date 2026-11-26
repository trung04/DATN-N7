import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTravelPreferenceCategories1794500017000 implements MigrationInterface {
  name = 'AddTravelPreferenceCategories1794500017000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "travel_preference_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "travel_preference_user_id" uuid NOT NULL,
        "place_category_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_travel_preference_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_travel_preference_categories_preference"
          FOREIGN KEY ("travel_preference_user_id")
          REFERENCES "travel_preferences"("user_id") ON DELETE CASCADE,
        CONSTRAINT "FK_travel_preference_categories_category"
          FOREIGN KEY ("place_category_id")
          REFERENCES "place_categories"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_travel_preference_categories_active"
      ON "travel_preference_categories" ("travel_preference_user_id", "place_category_id")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_travel_preference_categories_active_category"
      ON "travel_preference_categories" ("place_category_id", "travel_preference_user_id")
      WHERE "deleted_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "travel_preference_categories"');
  }
}
