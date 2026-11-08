import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HotelEntity } from './hotel.entity';

export enum HotelDocumentType {
  BUSINESS_LICENSE = 'BUSINESS_LICENSE',
  HOTEL_LICENSE = 'HOTEL_LICENSE',
  OWNERSHIP_DOCUMENT = 'OWNERSHIP_DOCUMENT',
  TAX_DOCUMENT = 'TAX_DOCUMENT',
  OTHER = 'OTHER',
}

@Entity({ name: 'hotel_documents' })
@Index('IDX_hotel_documents_hotel_id', ['hotelId'])
@Index('IDX_hotel_documents_type', ['documentType'])
export class HotelDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string;

  @Column({ name: 'document_type', type: 'varchar', length: 40 })
  documentType: HotelDocumentType;

  @Column({ name: 'document_number', type: 'varchar', length: 100 })
  documentNumber: string;

  @Column({ name: 'file_url', type: 'varchar', length: 2048 })
  fileUrl: string;

  @Column({ name: 'issued_at', type: 'date', nullable: true })
  issuedAt: string | null;

  @Column({ name: 'expires_at', type: 'date', nullable: true })
  expiresAt: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => HotelEntity, (hotel) => hotel.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'hotel_id' })
  hotel: HotelEntity;
}
