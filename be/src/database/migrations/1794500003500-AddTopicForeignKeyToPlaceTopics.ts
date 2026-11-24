import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTopicForeignKeyToPlaceTopics1794500003500
  implements MigrationInterface
{
  name = 'AddTopicForeignKeyToPlaceTopics1794500003500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_place_topics_topic'
            AND conrelid = 'place_topics'::regclass
        ) THEN
          ALTER TABLE "place_topics"
            ADD CONSTRAINT "FK_place_topics_topic"
            FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT;
        END IF;
      END
      $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "place_topics" DROP CONSTRAINT IF EXISTS "FK_place_topics_topic"',
    );
  }
}
