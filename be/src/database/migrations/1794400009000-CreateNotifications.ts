import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1794400009000 implements MigrationInterface {
  name = 'CreateNotifications1794400009000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "type" varchar(40) NOT NULL,
        "title" varchar(160) NOT NULL,
        "message" text NOT NULL,
        "link" varchar(255) NOT NULL,
        "event_key" varchar(180) NOT NULL,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user_id_users_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_notifications_event_key" UNIQUE ("event_key")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_user_created"
      ON "notifications" ("user_id", "created_at" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_user_unread"
      ON "notifications" ("user_id", "created_at" DESC)
      WHERE "read_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_notifications_user_unread"');
    await queryRunner.query('DROP INDEX "IDX_notifications_user_created"');
    await queryRunner.query('DROP TABLE "notifications"');
  }
}
