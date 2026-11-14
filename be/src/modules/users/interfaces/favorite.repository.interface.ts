import { FavoriteTargetType } from '../entities/user-favorite.entity';

export const FAVORITE_REPOSITORY = Symbol('FAVORITE_REPOSITORY');

export interface FavoriteData {
  targetType: FavoriteTargetType;
  targetId: string;
  createdAt: Date;
}

export interface FavoriteRepository {
  findByUserId(userId: string): Promise<FavoriteData[]>;
  toggle(userId: string, targetType: FavoriteTargetType, targetId: string): Promise<boolean>;
}
