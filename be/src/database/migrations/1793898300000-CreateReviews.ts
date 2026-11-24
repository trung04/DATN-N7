import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReviews1793898300000 implements MigrationInterface {
  name = 'CreateReviews1793898300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "hotel_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "stars" smallint NOT NULL,
        "content" text NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "moderation_reason" text,
        "moderated_by" uuid,
        "moderated_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reviews_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reviews_booking_id" UNIQUE ("booking_id"),
        CONSTRAINT "CHK_reviews_stars" CHECK ("stars" BETWEEN 1 AND 5),
        CONSTRAINT "CHK_reviews_content_nonempty" CHECK (btrim("content") <> ''),
        CONSTRAINT "CHK_reviews_status" CHECK ("status" IN ('PENDING', 'VISIBLE', 'HIDDEN')),
        CONSTRAINT "FK_reviews_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reviews_hotel" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reviews_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_reviews_hotel_status_created" ON "reviews" ("hotel_id", "status", "created_at")');
    await queryRunner.query('CREATE INDEX "IDX_reviews_user_id" ON "reviews" ("user_id")');
    await queryRunner.query(`
      CREATE TABLE "review_moderation_histories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "review_id" uuid NOT NULL,
        "actor_user_id" uuid NOT NULL,
        "action" varchar(20) NOT NULL,
        "reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_review_moderation_histories_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_review_moderation_histories_action" CHECK ("action" IN ('APPROVE', 'HIDE', 'RESTORE')),
        CONSTRAINT "FK_review_moderation_histories_review" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_review_moderation_histories_review_created" ON "review_moderation_histories" ("review_id", "created_at")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "review_moderation_histories"');
    await queryRunner.query('DROP TABLE "reviews"');
  }
}
