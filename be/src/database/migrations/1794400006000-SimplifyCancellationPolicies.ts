import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the legacy list of hourly rules with one policy per hotel.
 * Existing booking snapshots remain untouched. For legacy schedules, the
 * first rule starting at hour zero becomes the free-cancellation threshold;
 * the latest rule supplies the late penalty. Old ranges are retained in each
 * row's description for reference, while only the first row remains active.
 */
export class SimplifyCancellationPolicies1794400006000
  implements MigrationInterface
{
  name = 'SimplifyCancellationPolicies1794400006000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        ADD COLUMN "cancel_hours" integer NOT NULL DEFAULT 24,
        ADD COLUMN "penalty_percent" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN "is_active" boolean NOT NULL DEFAULT false,
        ADD COLUMN "created_at" timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      WITH policy_summary AS (
        SELECT
          "hotel_id",
          (ARRAY_AGG("id" ORDER BY "min_hours_after_booking", "max_hours_after_booking" NULLS LAST, "id"))[1] AS first_policy_id,
          (ARRAY_AGG("max_hours_after_booking" ORDER BY "min_hours_after_booking", "max_hours_after_booking" NULLS LAST, "id"))[1] AS first_max_hours,
          (ARRAY_AGG("cancellation_fee_rate" ORDER BY "min_hours_after_booking" DESC, "max_hours_after_booking" DESC NULLS FIRST, "id" DESC))[1] AS latest_penalty,
          BOOL_AND("cancellation_allowed") AS all_policies_allow_cancellation,
          BOOL_OR("min_hours_after_booking" = 0) AS starts_at_booking
        FROM "cancellation_policies"
        GROUP BY "hotel_id"
      )
      UPDATE "cancellation_policies" policy
      SET
        "cancel_hours" = CASE WHEN summary.starts_at_booking
          THEN COALESCE(summary.first_max_hours, 0) ELSE 0 END,
        "penalty_percent" = COALESCE(summary.latest_penalty, policy."cancellation_fee_rate", 0),
        "cancellation_allowed" = summary.all_policies_allow_cancellation,
        "is_active" = summary.starts_at_booking AND policy."id" = summary.first_policy_id
      FROM policy_summary summary
      WHERE summary."hotel_id" = policy."hotel_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        DROP CONSTRAINT IF EXISTS "CHK_cancellation_policy_fee_required",
        DROP CONSTRAINT IF EXISTS "CHK_cancellation_policies_hours_after_booking_range"
    `);
    await queryRunner.query(`
      UPDATE "cancellation_policies"
      SET "description" = 'Chính sách cũ chưa có mô tả lý do không cho hủy; vui lòng cập nhật trước khi bật lại.'
      WHERE "cancellation_allowed" = false
        AND NULLIF(BTRIM("description"), '') IS NULL
    `);
    await queryRunner.query(`
      UPDATE "cancellation_policies" policy
      SET "description" = CONCAT_WS(E'\\n', NULLIF(BTRIM(policy."description"), ''),
        FORMAT('[Lưu điều khoản cũ để tham khảo] Áp dụng từ %s đến %s giờ sau khi đặt; %s; mức phí cũ %s%%.',
          policy."min_hours_after_booking",
          COALESCE(policy."max_hours_after_booking"::text, 'không giới hạn'),
          CASE WHEN policy."cancellation_allowed" THEN 'được hủy' ELSE 'không được hủy' END,
          COALESCE(policy."cancellation_fee_rate"::text, 'chưa xác định')))
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        DROP COLUMN "cancellation_window",
        DROP COLUMN "min_hours_after_booking",
        DROP COLUMN "max_hours_after_booking",
        DROP COLUMN "cancellation_fee_rate"
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        ALTER COLUMN "name" TYPE varchar(100),
        ADD CONSTRAINT "CHK_cancellation_policies_cancel_hours"
          CHECK ("cancel_hours" BETWEEN 0 AND 87600),
        ADD CONSTRAINT "CHK_cancellation_policies_penalty_percent"
          CHECK ("penalty_percent" BETWEEN 0 AND 100),
        ADD CONSTRAINT "CHK_cancellation_policies_no_cancel_description"
          CHECK ("cancellation_allowed" = true OR NULLIF(BTRIM("description"), '') IS NOT NULL)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cancellation_policies_one_active_per_hotel"
      ON "cancellation_policies" ("hotel_id")
      WHERE "is_active" = true
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "UQ_cancellation_policies_one_active_per_hotel"',
    );
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        DROP CONSTRAINT "CHK_cancellation_policies_no_cancel_description",
        DROP CONSTRAINT "CHK_cancellation_policies_penalty_percent",
        DROP CONSTRAINT "CHK_cancellation_policies_cancel_hours",
        ALTER COLUMN "name" TYPE varchar(120),
        ADD COLUMN "cancellation_window" integer,
        ADD COLUMN "min_hours_after_booking" integer NOT NULL DEFAULT 0,
        ADD COLUMN "max_hours_after_booking" integer,
        ADD COLUMN "cancellation_fee_rate" numeric(5,2)
    `);
    await queryRunner.query(`
      UPDATE "cancellation_policies"
      SET "cancellation_fee_rate" = "penalty_percent",
          "max_hours_after_booking" = NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cancellation_policies"
        ADD CONSTRAINT "CHK_cancellation_policy_fee_required"
          CHECK ("cancellation_allowed" = false OR "cancellation_fee_rate" IS NOT NULL),
        ADD CONSTRAINT "CHK_cancellation_policies_hours_after_booking_range"
          CHECK ("min_hours_after_booking" >= 0 AND
            ("max_hours_after_booking" IS NULL OR
             "max_hours_after_booking" > "min_hours_after_booking")),
        DROP COLUMN "cancel_hours",
        DROP COLUMN "penalty_percent",
        DROP COLUMN "is_active",
        DROP COLUMN "created_at",
        DROP COLUMN "updated_at"
    `);
  }
}
