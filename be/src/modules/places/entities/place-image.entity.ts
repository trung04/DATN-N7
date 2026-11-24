import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'place_images' })
@Index('UQ_place_images_active_image', ['placeId', 'imageId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('UQ_place_images_active_order', ['placeId', 'imageOrder'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class PlaceImageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'place_id', type: 'uuid' })
  placeId: string;

  @Column({ name: 'image_id', type: 'uuid' })
  imageId: string;

  @Column({ name: 'image_order', type: 'integer', default: 1 })
  imageOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
