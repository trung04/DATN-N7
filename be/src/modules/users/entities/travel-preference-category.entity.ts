import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'travel_preference_categories' })
@Index(
  'UQ_travel_preference_categories_active',
  ['travelPreferenceUserId', 'placeCategoryId'],
  { unique: true, where: '"deleted_at" IS NULL' },
)
export class TravelPreferenceCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'travel_preference_user_id', type: 'uuid' })
  travelPreferenceUserId: string;

  @Column({ name: 'place_category_id', type: 'uuid' })
  placeCategoryId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
