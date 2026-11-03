import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHotelOwners1793696800000 implements MigrationInterface {
  name = 'CreateHotelOwners1793696800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "hotel_owners" (
        "user_id" uuid NOT NULL,
        "bank_name" varchar(150),
        "bank_account_number" varchar(50),
        "bank_account_holder" varchar(150),
        CONSTRAINT "PK_hotel_owners_user_id" PRIMARY KEY ("user_id"),
        CONSTRAINT "CHK_hotel_owners_bank_name_nonempty"
          CHECK ("bank_name" IS NULL OR btrim("bank_name") <> ''),
        CONSTRAINT "CHK_hotel_owners_account_number_nonempty"
          CHECK ("bank_account_number" IS NULL OR btrim("bank_account_number") <> ''),
        CONSTRAINT "CHK_hotel_owners_account_holder_nonempty"
          CHECK ("bank_account_holder" IS NULL OR btrim("bank_account_holder") <> ''),
        CONSTRAINT "FK_hotel_owners_user_id_users_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "hotel_owners"');
  }
}
