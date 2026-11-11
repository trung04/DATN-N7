import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HotelDocumentEntity } from './hotel-document.entity';
import { HotelImageEntity } from './hotel-image.entity';

export enum HotelStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Entity({ name: 'hotels' })
@Index('UQ_hotels_tax_code', ['taxCode'], { unique: true })
@Index('IDX_hotels_owner_user_id', ['ownerUserId'])
@Index('IDX_hotels_place_id', ['placeId'])
@Index('IDX_hotels_status', ['status'])
export class HotelEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId: string;

  @Column({ name: 'place_id', type: 'uuid', nullable: true })
  placeId: string | null;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 200 })
  legalName: string;

  @Column({ name: 'tax_code', type: 'varchar', length: 50 })
  taxCode: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500 })
  address: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 30 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'star_rating', type: 'smallint', nullable: true })
  starRating: number | null;

  @Column({ name: 'check_in_time', type: 'time' })
  checkInTime: string;

  @Column({ name: 'check_out_time', type: 'time' })
  checkOutTime: string;

  @Column({ type: 'varchar', length: 30 })
  status: HotelStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => HotelDocumentEntity, (document) => document.hotel)
  documents: HotelDocumentEntity[];

  @OneToMany(() => HotelImageEntity, (image) => image.hotel)
  images: HotelImageEntity[];
}
