import { CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'settlement_batch_events' })
@Index('IDX_settlement_batch_events_batch_created', ['settlementBatchId', 'createdAt'])
export class SettlementBatchEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'settlement_batch_id', type: 'uuid' })
  settlementBatchId: string;

  @Column({ name: 'from_status', type: 'varchar', length: 20, nullable: true })
  fromStatus: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 20 })
  toStatus: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'transfer_reference', type: 'varchar', length: 255, nullable: true })
  transferReference: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
