import { Inject, Injectable } from '@nestjs/common';
import { FAVORITE_REPOSITORY } from '../interfaces/favorite.repository.interface';
import type { FavoriteRepository } from '../interfaces/favorite.repository.interface';
import { FavoriteTargetType } from '../entities/user-favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(@Inject(FAVORITE_REPOSITORY) private readonly repository: FavoriteRepository) {}

  findMine(userId: string) {
    return this.repository.findByUserId(userId);
  }

  toggle(userId: string, targetType: FavoriteTargetType, targetId: string) {
    return this.repository.toggle(userId, targetType, targetId);
  }
}
