import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHotels1793697600000 implements MigrationInterface {
  name = 'CreateHotels1793697600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "hotels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_user_id" uuid NOT NULL,
        "place_id" uuid,
        "name" varchar(200) NOT NULL,
        "legal_name" varchar(200) NOT NULL,
        "tax_code" varchar(50) NOT NULL,
        "description" text,
        "address" varchar(500) NOT NULL,
        "phone_number" varchar(30) NOT NULL,
        "email" varchar(254) NOT NULL,
        "star_rating" smallint,
        "check_in_time" time NOT NULL,
        "check_out_time" time NOT NULL,
        "status" varchar(30) NOT NULL,
        "submitted_at" timestamptz,
        "reviewed_at" timestamptz,
        "reviewed_by" uuid,
        "rejection_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotels" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hotels_tax_code" UNIQUE ("tax_code"),
        CONSTRAINT "CHK_hotels_star_rating"
          CHECK ("star_rating" IS NULL OR "star_rating" BETWEEN 1 AND 5),
        CONSTRAINT "CHK_hotels_status"
          CHECK ("status" IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE', 'SUSPENDED')),
        CONSTRAINT "FK_hotels_owner_user_id_hotel_owners_user_id"
          FOREIGN KEY ("owner_user_id") REFERENCES "hotel_owners"("user_id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_hotels_place_id_places_id"
          FOREIGN KEY ("place_id") REFERENCES "places"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_hotels_reviewed_by_users_id"
          FOREIGN KEY ("reviewed_by") REFERENCES "users"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_hotels_owner_user_id" ON "hotels" ("owner_user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_hotels_place_id" ON "hotels" ("place_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_hotels_status" ON "hotels" ("status")',
    );

    await queryRunner.query(`
      CREATE TABLE "hotel_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hotel_id" uuid NOT NULL,
        "document_type" varchar(40) NOT NULL,
        "document_number" varchar(100) NOT NULL,
        "file_url" varchar(2048) NOT NULL,
        "issued_at" date,
        "expires_at" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotel_documents" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_hotel_documents_type"
          CHECK ("document_type" IN ('BUSINESS_LICENSE', 'HOTEL_LICENSE', 'OWNERSHIP_DOCUMENT', 'TAX_DOCUMENT', 'OTHER')),
        CONSTRAINT "CHK_hotel_documents_dates"
          CHECK ("issued_at" IS NULL OR "expires_at" IS NULL OR "expires_at" >= "issued_at"),
        CONSTRAINT "FK_hotel_documents_hotel_id_hotels_id"
          FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_documents_hotel_id" ON "hotel_documents" ("hotel_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_documents_type" ON "hotel_documents" ("document_type")',
    );

    await queryRunner.query(`
      CREATE TABLE "hotel_review_histories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hotel_id" uuid NOT NULL,
        "actor_user_id" uuid NOT NULL,
        "action" varchar(30) NOT NULL,
        "reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hotel_review_histories" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_hotel_review_histories_action"
          CHECK ("action" IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'REACTIVATED', 'DEACTIVATED')),
        CONSTRAINT "FK_hotel_review_histories_hotel_id_hotels_id"
          FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_hotel_review_histories_actor_user_id_users_id"
          FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_hotel_review_histories_hotel_id" ON "hotel_review_histories" ("hotel_id")',
    );

    await queryRunner.query(`
      ALTER TABLE "rooms"
        ADD CONSTRAINT "FK_rooms_hotel_id_hotels_id"
        FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id")
        ON DELETE RESTRICT NOT VALID
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        ADD CONSTRAINT "FK_cancellation_policies_hotel_id_hotels_id"
        FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id")
        ON DELETE RESTRICT NOT VALID
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD CONSTRAINT "FK_bookings_hotel_id_hotels_id"
        FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id")
        ON DELETE RESTRICT NOT VALID
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_hotel_id_hotels_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "cancellation_policies" DROP CONSTRAINT "FK_cancellation_policies_hotel_id_hotels_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "rooms" DROP CONSTRAINT "FK_rooms_hotel_id_hotels_id"',
    );
    await queryRunner.query('DROP TABLE "hotel_review_histories"');
    await queryRunner.query('DROP TABLE "hotel_documents"');
    await queryRunner.query('DROP TABLE "hotels"');
  }
}
