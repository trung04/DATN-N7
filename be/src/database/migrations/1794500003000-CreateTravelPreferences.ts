import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTravelPreferences1794500003000 implements MigrationInterface {
  name = 'CreateTravelPreferences1794500003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "topics" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(50) NOT NULL,
        "name" varchar(120) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_topics_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_topics_code_active"
      ON "topics" ("code") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE TABLE "travel_preferences" (
        "user_id" uuid NOT NULL,
        "min_budget" numeric(14,2),
        "max_budget" numeric(14,2),
        "currency" char(3) NOT NULL DEFAULT 'VND',
        "preferred_duration_days" integer,
        "travel_style" varchar(50) NOT NULL,
        "preferred_transport" varchar(50) NOT NULL,
        "preferred_destinations" text[] NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_travel_preferences_user_id" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_travel_preferences_user_id_users_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_travel_preferences_budget_range"
          CHECK ("min_budget" IS NULL OR "max_budget" IS NULL OR "min_budget" <= "max_budget"),
        CONSTRAINT "CHK_travel_preferences_duration"
          CHECK ("preferred_duration_days" IS NULL OR "preferred_duration_days" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "travel_preference_topics" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "travel_preference_user_id" uuid NOT NULL,
        "topic_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_travel_preference_topics_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_travel_preference_topics_preference"
          FOREIGN KEY ("travel_preference_user_id") REFERENCES "travel_preferences"("user_id") ON DELETE CASCADE,
        CONSTRAINT "FK_travel_preference_topics_topic"
          FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_travel_preference_topics_active"
      ON "travel_preference_topics" ("travel_preference_user_id", "topic_id")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_travel_preference_topics_active_topic"
      ON "travel_preference_topics" ("topic_id", "travel_preference_user_id")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO "topics" ("code", "name") VALUES
        ('BEACH', 'Biển'), ('NATURE', 'Thiên nhiên'), ('FOOD', 'Ẩm thực'),
        ('CULTURE', 'Văn hóa'), ('SHOPPING', 'Mua sắm'),
        ('RELAXATION', 'Nghỉ dưỡng'), ('EXPLORATION', 'Khám phá'),
        ('FAMILY', 'Gia đình')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "travel_preference_topics"');
    await queryRunner.query('DROP TABLE "travel_preferences"');
    await queryRunner.query('DROP TABLE "topics"');
  }
}
