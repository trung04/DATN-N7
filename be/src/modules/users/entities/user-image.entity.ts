import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserImageType {
  AVATAR = 'AVATAR',
  PROFILE = 'PROFILE',
}

@Entity({ name: 'user_images' })
@Index('UQ_user_images_active_type', ['userId', 'imageType'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('IDX_user_images_active_image', ['imageId'], {
  where: '"deleted_at" IS NULL',
})
export class UserImageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'image_id', type: 'uuid' })
  imageId: string;

  @Column({
    name: 'image_type',
    type: 'varchar',
    length: 30,
    default: 'AVATAR',
  })
  imageType: UserImageType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
