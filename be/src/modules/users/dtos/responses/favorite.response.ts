import { ApiProperty } from '@nestjs/swagger';
import { FavoriteTargetType } from '../../entities/user-favorite.entity';

export class FavoriteResponse {
  @ApiProperty({ enum: FavoriteTargetType })
  targetType: FavoriteTargetType;

  @ApiProperty({ format: 'uuid' })
  targetId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class FavoriteToggleResponse {
  @ApiProperty()
  saved: boolean;
}
