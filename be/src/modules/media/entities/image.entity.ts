import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ImageStorageProvider {
  MINIO = 'MINIO',
  EXTERNAL = 'EXTERNAL',
}

@Entity({ name: 'images' })
@Index('UQ_images_url_active', ['imageUrl'], {
  unique: true,
  where: '"deleted_at" IS NULL AND "image_url" IS NOT NULL',
})
@Index('UQ_images_object_key_active', ['objectKey'], {
  unique: true,
  where: '"deleted_at" IS NULL AND "object_key" IS NOT NULL',
})
@Check(
  'CHK_images_storage_provider',
  `"storage_provider" IN ('MINIO', 'EXTERNAL')`,
)
@Check(
  'CHK_images_storage_location',
  `("storage_provider" = 'MINIO' AND "object_key" IS NOT NULL AND "image_url" IS NULL)
    OR ("storage_provider" = 'EXTERNAL' AND "image_url" IS NOT NULL AND "object_key" IS NULL)`,
)
@Check(
  'CHK_images_managed_metadata',
  `"storage_provider" <> 'MINIO'
    OR ("content_type" IS NOT NULL AND "byte_size" > 0 AND "width" > 0 AND "height" > 0)`,
)
@Check(
  'CHK_images_optional_metadata',
  `("byte_size" IS NULL OR "byte_size" > 0)
    AND ("width" IS NULL OR "width" > 0)
    AND ("height" IS NULL OR "height" > 0)`,
)
export class ImageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'storage_provider',
    type: 'varchar',
    length: 30,
    default: ImageStorageProvider.EXTERNAL,
  })
  storageProvider: ImageStorageProvider;

  @Column({ name: 'object_key', type: 'varchar', length: 500, nullable: true })
  objectKey: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({
    name: 'content_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  contentType: string | null;

  @Column({ name: 'byte_size', type: 'integer', nullable: true })
  byteSize: number | null;

  @Column({ type: 'integer', nullable: true })
  width: number | null;

  @Column({ type: 'integer', nullable: true })
  height: number | null;

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
