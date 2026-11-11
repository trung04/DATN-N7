import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'place_category_mappings' })
@Index('UQ_place_category_mappings_active', ['placeId', 'placeCategoryId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index(
  'IDX_place_category_mappings_active_category',
  ['placeCategoryId', 'placeId'],
  { where: '"deleted_at" IS NULL' },
)
export class PlaceCategoryMappingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'place_id', type: 'uuid' })
  placeId: string;

  @Column({ name: 'place_category_id', type: 'uuid' })
  placeCategoryId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
