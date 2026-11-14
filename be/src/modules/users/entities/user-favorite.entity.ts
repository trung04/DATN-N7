import { CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum FavoriteTargetType {
  PLACE = 'PLACE',
  HOTEL = 'HOTEL',
}

@Entity({ name: 'user_favorites' })
@Index('UQ_user_favorites_user_target', ['userId', 'targetType', 'targetId'], { unique: true })
export class UserFavoriteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'target_type', type: 'varchar', length: 16 })
  targetType: FavoriteTargetType;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
