import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'place_topics' })
@Index('UQ_place_topics_active', ['placeId', 'topicId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('IDX_place_topics_active_topic', ['topicId', 'placeId'], {
  where: '"deleted_at" IS NULL',
})
export class PlaceTopicEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'place_id', type: 'uuid' })
  placeId: string;

  @Column({ name: 'topic_id', type: 'uuid' })
  topicId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
