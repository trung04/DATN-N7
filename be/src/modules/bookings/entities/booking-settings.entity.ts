import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'booking_settings' })
export class BookingSettingsEntity {
  @PrimaryColumn({ type: 'smallint' })
  id: number;

  @Column({ name: 'commission_rate', type: 'numeric', precision: 5, scale: 2 })
  commissionRate: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
