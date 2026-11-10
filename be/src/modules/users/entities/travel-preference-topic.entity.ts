import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'travel_preference_topics' })
@Index(
  'UQ_travel_preference_topics_active',
  ['travelPreferenceUserId', 'topicId'],
  { unique: true, where: '"deleted_at" IS NULL' },
)
@Index(
  'IDX_travel_preference_topics_active_topic',
  ['topicId', 'travelPreferenceUserId'],
  { where: '"deleted_at" IS NULL' },
)
export class TravelPreferenceTopicEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'travel_preference_user_id', type: 'uuid' })
  travelPreferenceUserId: string;

  @Column({ name: 'topic_id', type: 'uuid' })
  topicId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
