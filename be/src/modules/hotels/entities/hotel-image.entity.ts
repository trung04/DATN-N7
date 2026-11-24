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
import { HotelEntity } from './hotel.entity';

@Entity({ name: 'hotel_images' })
@Index('UQ_hotel_images_active_image', ['hotelId', 'imageId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('UQ_hotel_images_active_order', ['hotelId', 'imageOrder'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('IDX_hotel_images_active_image', ['imageId'], {
  where: '"deleted_at" IS NULL',
})
export class HotelImageEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'hotel_id', type: 'uuid' }) hotelId: string;
  @Column({ name: 'image_id', type: 'uuid' }) imageId: string;
  @Column({ name: 'image_order', type: 'integer', default: 1 })
  imageOrder: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
  @ManyToOne(() => HotelEntity, (hotel) => hotel.images, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'hotel_id' })
  hotel: HotelEntity;
  @ManyToOne(() => ImageEntity, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'image_id' })
  image: ImageEntity;
}
