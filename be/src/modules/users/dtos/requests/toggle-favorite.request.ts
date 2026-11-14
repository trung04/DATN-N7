import { IsEnum, IsUUID } from 'class-validator';
import { FavoriteTargetType } from '../../entities/user-favorite.entity';

export class ToggleFavoriteRequest {
  @IsEnum(FavoriteTargetType)
  targetType: FavoriteTargetType;

  @IsUUID()
  targetId: string;
}
