import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { HotelEntity } from './hotel.entity';

@Entity({ name: 'hotel_images' })
@Index('IDX_hotel_images_hotel_created', ['hotelId', 'createdAt'])
export class HotelImageEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'hotel_id', type: 'uuid' }) hotelId: string;
  @Column({ name: 'object_key', type: 'varchar', length: 200, unique: true })
  objectKey: string;
  @Column({ name: 'content_type', type: 'varchar', length: 50 })
  contentType: string;
  @Column({ name: 'byte_size', type: 'integer' }) byteSize: number;
  @Column({ type: 'integer' }) width: number;
  @Column({ type: 'integer' }) height: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @ManyToOne(() => HotelEntity, (hotel) => hotel.images, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'hotel_id' })
  hotel: HotelEntity;
}
