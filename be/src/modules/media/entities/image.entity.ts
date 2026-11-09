import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'images' })
@Index('UQ_images_url_active', ['imageUrl'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class ImageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'image_url', type: 'text' })
  imageUrl: string;

  @Column({ name: 'alt_text', type: 'varchar', length: 255, nullable: true })
  altText: string | null;

  @Column({
    name: 'source_provider',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  sourceProvider: string | null;

  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({ name: 'attribution_text', type: 'text', nullable: true })
  attributionText: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
