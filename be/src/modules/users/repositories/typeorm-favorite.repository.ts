import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserFavoriteEntity } from '../entities/user-favorite.entity';
import type { FavoriteRepository } from '../interfaces/favorite.repository.interface';
import { FavoriteTargetType } from '../entities/user-favorite.entity';

@Injectable()
export class TypeOrmFavoriteRepository implements FavoriteRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserFavoriteEntity)
    private readonly favorites: Repository<UserFavoriteEntity>,
  ) {}

  async findByUserId(userId: string) {
    const rows = await this.favorites.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return rows.map(({ targetType, targetId, createdAt }) => ({ targetType, targetId, createdAt }));
  }

  toggle(userId: string, targetType: FavoriteTargetType, targetId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      // Serialize concurrent toggles for the same user's favorite so a rapid double-click is deterministic.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [userId, `${targetType}:${targetId}`]);
      const repository = manager.getRepository(UserFavoriteEntity);
      const where = { userId, targetType, targetId };
      const existing = await repository.findOneBy(where);
      if (existing) {
        await repository.delete(where);
        return false;
      }
      await repository.insert(where);
      return true;
    });
  }
}
