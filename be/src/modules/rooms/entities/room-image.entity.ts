import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ImageEntity } from '../../media/entities/image.entity';

@Entity({ name: 'room_images' })
@Index('UQ_room_images_active_image', ['roomId', 'imageId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('UQ_room_images_active_order', ['roomId', 'imageOrder'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class RoomImageEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'room_id', type: 'uuid' }) roomId: string;
  @Column({ name: 'image_id', type: 'uuid' }) imageId: string;
  @Column({ name: 'image_order', type: 'integer', default: 1 })
  imageOrder: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
  @ManyToOne(() => ImageEntity, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'image_id' })
  image: ImageEntity;
}
