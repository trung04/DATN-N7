import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationEmailOutbox1794500010000
  implements MigrationInterface
{
  name = 'CreateNotificationEmailOutbox1794500010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      [
        'CREATE TABLE "notification_email_deliveries" (',
        '"id" uuid NOT NULL DEFAULT gen_random_uuid(),',
        '"notification_id" uuid NOT NULL,',
        '"recipient_email" varchar(320) NOT NULL,',
        '"status" varchar(20) NOT NULL DEFAULT \'PENDING\',',
        '"attempt_count" integer NOT NULL DEFAULT 0,',
        '"available_at" timestamptz NOT NULL DEFAULT now(),',
        '"claimed_at" timestamptz,',
        '"sent_at" timestamptz,',
        '"last_error" varchar(500),',
        '"created_at" timestamptz NOT NULL DEFAULT now(),',
        '"updated_at" timestamptz NOT NULL DEFAULT now(),',
        'CONSTRAINT "PK_notification_email_deliveries_id" PRIMARY KEY ("id"),',
        'CONSTRAINT "FK_notification_email_deliveries_notification_id"',
        'FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE,',
        'CONSTRAINT "UQ_notification_email_deliveries_notification" UNIQUE ("notification_id"),',
        'CONSTRAINT "CHK_notification_email_deliveries_status"',
        'CHECK ("status" IN (\'PENDING\', \'PROCESSING\', \'SENT\', \'FAILED\')),',
        'CONSTRAINT "CHK_notification_email_deliveries_attempts"',
        'CHECK ("attempt_count" >= 0)',
        ')',
      ].join(' '),
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_notification_email_deliveries_due" ON "notification_email_deliveries" ("status", "available_at", "created_at")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_notification_email_deliveries_due"',
    );
    await queryRunner.query('DROP TABLE "notification_email_deliveries"');
  }
}
